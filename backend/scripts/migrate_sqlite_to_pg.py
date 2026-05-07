"""One-shot migration: local SQLite → Neon PostgreSQL.

Usage:
    python backend/scripts/migrate_sqlite_to_pg.py \
        --sqlite-path backend/math_wiki.db \
        --database-url "postgresql://user:pass@host/dbname?sslmode=require"
"""
import argparse
import asyncio
import json
import sqlite3
import sys
from pathlib import Path


async def _register_codecs(conn):
    import pgvector.asyncpg
    await pgvector.asyncpg.register_vector(conn)


def _embed_batch(texts: list[str]) -> list[list[float]]:
    from FlagEmbedding import BGEM3FlagModel
    model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False)
    prefixed = [f"passage: {t}" for t in texts]
    out = model.encode(prefixed, return_dense=True, return_sparse=False, return_colbert_vecs=False)
    return out["dense_vecs"].tolist()


async def migrate(sqlite_path: str, database_url: str) -> None:
    import asyncpg

    sq = sqlite3.connect(sqlite_path)
    sq.row_factory = sqlite3.Row

    pool = await asyncpg.create_pool(
        database_url,
        min_size=1,
        max_size=5,
        statement_cache_size=0,
        init=_register_codecs,
    )

    try:
        await _migrate_wiki_units(sq, pool)
        await _migrate_problems(sq, pool)
        await _migrate_table(sq, pool, "wiki_unit_history",
            "INSERT INTO wiki_unit_history (id,unit_id,version,content,edited_by,reason,edited_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
            lambda r: (r["id"], r["unit_id"], r["version"], r["content"],
                       r["edited_by"], r["reason"], r["edited_at"]))
        await _migrate_table(sq, pool, "unit_feedback",
            "INSERT INTO unit_feedback (id,unit_id,problem_text,feedback_type,comment,resolved,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
            lambda r: (r["id"], r["unit_id"], r["problem_text"], r["feedback_type"],
                       r["comment"], bool(r["resolved"]), r["created_at"]))
        await _migrate_table(sq, pool, "flagged_solutions",
            "INSERT INTO flagged_solutions (id,problem_text,problem_hash,solver_output,flag_reason,reviewed,flagged_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
            lambda r: (r["id"], r["problem_text"], r["problem_hash"], r["solver_output"],
                       r["flag_reason"], bool(r["reviewed"]), r["flagged_at"]))
        await _migrate_table(sq, pool, "wiki_drafts",
            "INSERT INTO wiki_drafts (draft_id,source_url,source_text,proposed_units_json,"
            "final_units_json,topic_hint,status,reviewed_by,reviewed_at,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (draft_id) DO NOTHING",
            lambda r: (r["draft_id"], r["source_url"], r["source_text"], r["proposed_units_json"],
                       r["final_units_json"], r["topic_hint"], r["status"],
                       r["reviewed_by"], r["reviewed_at"], r["created_at"]))
        await _migrate_table(sq, pool, "solution_logs",
            "INSERT INTO solution_logs (id,problem_text,problem_hash,classified_topic,retrieved_ids,"
            "used_knowledge_ids,solver_confidence,validation_valid,validation_issues,wiki_assisted,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING",
            lambda r: (r["id"], r["problem_text"], r["problem_hash"], r["classified_topic"],
                       r["retrieved_ids"], r["used_knowledge_ids"], r["solver_confidence"],
                       bool(r["validation_valid"]), r["validation_issues"],
                       bool(r["wiki_assisted"]), r["created_at"]))
        await _migrate_table(sq, pool, "staged_wiki_units",
            "INSERT INTO staged_wiki_units (staged_id,unit_data,source,source_url,status,"
            "proposed_by,created_at,updated_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (staged_id) DO NOTHING",
            lambda r: (r["staged_id"], r["unit_data"], r["source"], r["source_url"],
                       r["status"], r["proposed_by"], r["created_at"], r["updated_at"]))
    finally:
        sq.close()
        await pool.close()


async def _migrate_wiki_units(sq: sqlite3.Connection, pool) -> None:
    rows = sq.execute("SELECT * FROM wiki_units").fetchall()
    if not rows:
        print("wiki_units: 0 rows — skipping")
        return

    print(f"wiki_units: computing embeddings for {len(rows)} rows…")
    loop = asyncio.get_event_loop()
    texts = [r["content"] for r in rows]
    # Run CPU-bound embed in executor
    embeddings = await loop.run_in_executor(None, _embed_batch, texts)

    inserted = skipped = 0
    async with pool.acquire() as conn:
        for row, emb in zip(rows, embeddings):
            result = await conn.execute(
                "INSERT INTO wiki_units "
                "(id,type,topic,subtopic,content,problem_ids,source,source_url,"
                "deleted,version,last_edited_by,created_at,updated_at,embedding) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) "
                "ON CONFLICT (id) DO NOTHING",
                row["id"], row["type"], row["topic"], row["subtopic"], row["content"],
                row["problem_ids"], row["source"] or "manual", row["source_url"],
                bool(row["deleted"]), row["version"], row["last_edited_by"],
                row["created_at"], row["updated_at"], emb,
            )
            if result.split()[-1] == "1":
                inserted += 1
            else:
                skipped += 1

    print(f"wiki_units: {inserted} → Neon, {skipped} skipped (duplicates)")


async def _migrate_problems(sq: sqlite3.Connection, pool) -> None:
    # Check if figure_svg column exists (added via migration in SQLite)
    cols = {r[1] for r in sq.execute("PRAGMA table_info(problems)").fetchall()}
    rows = sq.execute("SELECT * FROM problems").fetchall()
    if not rows:
        print("problems: 0 rows — skipping")
        return

    inserted = skipped = 0
    async with pool.acquire() as conn:
        for row in rows:
            result = await conn.execute(
                "INSERT INTO problems "
                "(problem_id,problem_text,choices,correct_answer,topic,subtopic,"
                "difficulty,problem_type,figure_svg,problem_hash,figure_type) "
                "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) "
                "ON CONFLICT (problem_id) DO NOTHING",
                row["problem_id"], row["problem_text"],
                row["choices"] if "choices" in cols else None,
                row["correct_answer"] if "correct_answer" in cols else None,
                row["topic"], row["subtopic"], row["difficulty"], row["problem_type"],
                row["figure_svg"] if "figure_svg" in cols else None,
                row["problem_hash"] if "problem_hash" in cols else None,
                row["figure_type"] if "figure_type" in cols else "svg",
            )
            if result.split()[-1] == "1":
                inserted += 1
            else:
                skipped += 1

    print(f"problems: {inserted} → Neon, {skipped} skipped (duplicates)")


async def _migrate_table(sq, pool, table, query, row_fn) -> None:
    try:
        rows = sq.execute(f"SELECT * FROM {table}").fetchall()
    except sqlite3.OperationalError:
        print(f"{table}: table not found in SQLite — skipping")
        return

    if not rows:
        print(f"{table}: 0 rows — skipping")
        return

    inserted = skipped = 0
    async with pool.acquire() as conn:
        for row in rows:
            result = await conn.execute(query, *row_fn(row))
            if result.split()[-1] == "1":
                inserted += 1
            else:
                skipped += 1

    print(f"{table}: {inserted} → Neon, {skipped} skipped (duplicates)")


def main():
    parser = argparse.ArgumentParser(description="Migrate math_wiki SQLite → Neon PostgreSQL")
    parser.add_argument("--sqlite-path", required=True, help="Path to math_wiki.db")
    parser.add_argument("--database-url", required=True, help="Neon PostgreSQL DSN")
    args = parser.parse_args()

    if not Path(args.sqlite_path).exists():
        print(f"ERROR: SQLite file not found: {args.sqlite_path}", file=sys.stderr)
        sys.exit(1)

    asyncio.run(migrate(args.sqlite_path, args.database_url))
    print("Migration complete.")


if __name__ == "__main__":
    main()
