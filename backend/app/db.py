"""asyncpg-compatible wrapper around aiosqlite for local SQLite storage.

Drop-in replacement for the asyncpg connection pool: same acquire(), fetchrow(),
fetch(), fetchval(), execute(), and transaction() API, so pg_db.py / analytics.py /
sanitizer.py require zero changes.

SQL translation handled automatically:
  $N placeholders  → ?
  = ANY($N)        → IN (?,?,?)  (array expansion)
  ::type casts     → stripped
  NOW()            → datetime('now')
  list params      → JSON-serialised (for embedding storage)

Architecture note:
  A single persistent aiosqlite connection is shared across all callers.  An
  asyncio.Lock serialises every acquire() so only one coroutine touches the
  SQLite file at a time.  This eliminates the concurrent-writer corruption that
  WAL mode's shared-memory coordination (-shm/-wal files) causes on
  network/container filesystems (NFS, Docker overlays, HuggingFace Spaces /data).
"""
import asyncio
import json
import logging
import re
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import aiosqlite

logger = logging.getLogger(__name__)


class Row(dict):
    """Dict that also supports positional (integer) access like asyncpg Record."""

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _translate(query: str, params: tuple) -> tuple[str, list]:
    """Translate PostgreSQL query + params to SQLite equivalents."""
    # Detect which $N positions are used by ANY($N) (0-based)
    any_positions: set[int] = set()
    for m in re.finditer(r"=\s*ANY\(\$(\d+)\)", query, re.IGNORECASE):
        any_positions.add(int(m.group(1)) - 1)

    # Expand = ANY($N) → IN (?,?,?)
    def _expand_any(m: re.Match) -> str:
        idx = int(m.group(1)) - 1
        arr = list(params[idx]) if params[idx] else []
        return f"IN ({','.join(['?'] * len(arr))})" if arr else "IN (NULL)"

    query = re.sub(r"=\s*ANY\(\$(\d+)\)", _expand_any, query, flags=re.IGNORECASE)

    # Strip PostgreSQL type casts: ::jsonb, ::timestamptz, ::text[], ::float, etc.
    query = re.sub(r"::[a-zA-Z_][\w\[\]]*", "", query)

    # Replace NOW() with SQLite equivalent
    query = re.sub(r"\bNOW\(\)", "datetime('now')", query, flags=re.IGNORECASE)

    # Build flat params, expanding ANY arrays and serialising lists→JSON
    new_params: list = []
    for i, p in enumerate(params):
        if i in any_positions:
            new_params.extend(list(p) if p else [])
        elif isinstance(p, list):
            new_params.append(json.dumps(p))
        else:
            new_params.append(p)

    # Replace remaining $N placeholders with ?
    query = re.sub(r"\$\d+", "?", query)

    return query, new_params


class _Connection:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn
        self._in_transaction = False

    async def fetchrow(self, query: str, *args) -> Optional[Row]:
        q, params = _translate(query, args)
        cur = await self._conn.execute(q, params)
        row = await cur.fetchone()
        # Commit after fetch so INSERT … RETURNING rows are both readable and persisted.
        if not self._in_transaction:
            await self._conn.commit()
        if row is None or cur.description is None:
            return None
        cols = [d[0] for d in cur.description]
        return Row(zip(cols, row))

    async def fetch(self, query: str, *args) -> list[Row]:
        q, params = _translate(query, args)
        cur = await self._conn.execute(q, params)
        rows = await cur.fetchall()
        if not self._in_transaction:
            await self._conn.commit()
        if cur.description is None:
            return []
        cols = [d[0] for d in cur.description]
        return [Row(zip(cols, r)) for r in rows]

    async def fetchval(self, query: str, *args) -> Any:
        q, params = _translate(query, args)
        cur = await self._conn.execute(q, params)
        row = await cur.fetchone()
        if not self._in_transaction:
            await self._conn.commit()
        return row[0] if row else None

    async def execute(self, query: str, *args) -> str:
        q, params = _translate(query, args)
        cur = await self._conn.execute(q, params)
        if not self._in_transaction:
            await self._conn.commit()
        return f"UPDATE {cur.rowcount}"

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[None, None]:
        self._in_transaction = True
        try:
            yield
            await self._conn.commit()
        except BaseException:
            await self._conn.rollback()
            raise
        finally:
            self._in_transaction = False


class AsyncSQLitePool:
    """Single-connection asyncpg-compatible pool backed by a local SQLite file.

    One persistent aiosqlite connection is shared by all callers.  An asyncio.Lock
    ensures only one coroutine executes against the connection at a time, which is
    both sufficient (single uvicorn process) and necessary (prevents WAL-mode
    shared-memory corruption on container/NFS filesystems).
    """

    def __init__(self, db_path: str) -> None:
        self._path = db_path
        self._conn: Optional[aiosqlite.Connection] = None
        self._lock: asyncio.Lock = asyncio.Lock()
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    async def initialize(self) -> None:
        """Open the persistent connection; auto-recover if the DB file is corrupted."""
        try:
            conn = await aiosqlite.connect(self._path)
            await conn.execute("PRAGMA foreign_keys = ON")
            cur = await conn.execute("PRAGMA integrity_check")
            row = await cur.fetchone()
            if row and row[0] != "ok":
                await conn.close()
                raise sqlite3.DatabaseError(f"integrity_check: {row[0]}")
            await conn.commit()
            self._conn = conn
        except (sqlite3.DatabaseError, Exception) as exc:
            logger.warning("DB at %s is corrupt (%s) — wiping and recreating", self._path, exc)
            if self._conn is not None:
                try:
                    await self._conn.close()
                except Exception:
                    pass
                self._conn = None
            path = Path(self._path)
            for suffix in ("", "-wal", "-shm"):
                candidate = Path(str(path) + suffix)
                if candidate.exists():
                    candidate.unlink()
            conn = await aiosqlite.connect(self._path)
            await conn.execute("PRAGMA foreign_keys = ON")
            await conn.commit()
            self._conn = conn
            logger.info("Fresh DB created at %s", self._path)

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[_Connection, None]:
        async with self._lock:
            yield _Connection(self._conn)

    # Shortcut methods (asyncpg pools expose these directly)

    async def fetchrow(self, query: str, *args) -> Optional[Row]:
        async with self.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetch(self, query: str, *args) -> list[Row]:
        async with self.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchval(self, query: str, *args) -> Any:
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args) -> str:
        async with self.acquire() as conn:
            return await conn.execute(query, *args)

    async def close(self) -> None:
        async with self._lock:
            if self._conn is not None:
                await self._conn.close()
                self._conn = None
