"""Migration runner — superseded by the auto-migration in db._ensure_tables().

All schema changes (tables, columns) are applied automatically when the server
starts or any DB function is first called. This script is kept for manual
on-demand use and documents what the auto-migration covers.

Usage: PYTHONPATH=backend python3 backend/scripts/migrations/run_migration.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


def run() -> None:
    from app.math_wiki.storage.db import _get_conn, _ensure_tables
    conn = _get_conn()
    _ensure_tables(conn)
    tables = sorted(
        r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    )
    cols = [r[1] for r in conn.execute("PRAGMA table_info(wiki_units)").fetchall()]
    print("Migration complete.")
    print(f"Tables: {tables}")
    print(f"wiki_units columns: {cols}")
    conn.close()


if __name__ == "__main__":
    run()
