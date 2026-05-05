"""Task 8 quality gate: flag low-quality units from a crawl batch.
Usage:
    python3 scripts/audit_crawl_quality.py --source aops --since 2024-01-01
    python3 scripts/audit_crawl_quality.py --source aops --since 2024-01-01 --delete-batch
"""
import argparse
import sqlite3
import sys

DB_PATH = "math_wiki.db"
MIN_LENGTH = 50

NAVIGATION_PATTERNS = [
    "Retrieved from",
    "This article",
    "AoPS Wiki",
    "Art of Problem Solving",
    "Category:",
    "Navigation menu",
]


def is_navigation_text(content: str) -> bool:
    return any(p in content for p in NAVIGATION_PATTERNS)


def main(source: str, since: str | None, delete_batch: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    query = "SELECT id, topic, subtopic, content, source_url FROM wiki_units WHERE deleted=0 AND source=?"
    params: list = [source]
    if since:
        # created_at column may not be present in older schema; fall back gracefully
        cols = {row[1] for row in conn.execute("PRAGMA table_info(wiki_units)").fetchall()}
        if "created_at" in cols:
            query += " AND created_at >= ?"
            params.append(since)
        else:
            print("Warning: no created_at column — ignoring --since filter.")

    rows = conn.execute(query, params).fetchall()
    print(f"Checking {len(rows)} units from source='{source}'" + (f" since {since}" if since else ""))

    flagged: list[tuple[str, str, str]] = []  # (id, reason, content_preview)

    for row in rows:
        content = row["content"]
        if len(content) < MIN_LENGTH:
            flagged.append((row["id"], f"too_short ({len(content)} chars)", content))
        elif is_navigation_text(content):
            flagged.append((row["id"], "navigation_text", content[:100]))

    total = len(rows)
    pct = (len(flagged) / total * 100) if total else 0
    print(f"Flagged: {len(flagged)} / {total} ({pct:.1f}%)")

    for uid, reason, preview in flagged:
        print(f"  [{reason}] {uid}: {preview[:80]!r}")

    if pct > 10:
        print(f"\nWARNING: >10% failure rate — diagnose concept_ingest before continuing.")
        if not delete_batch:
            print("Re-run with --delete-batch to soft-delete entire batch.")

    if delete_batch and flagged:
        ids = [f[0] for f in flagged]
        conn.execute(
            f"UPDATE wiki_units SET deleted=1 WHERE id IN ({','.join('?'*len(ids))})",
            ids,
        )
        conn.commit()
        print(f"\nSoft-deleted {len(ids)} flagged units.")

    conn.close()
    return len(flagged)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="aops")
    parser.add_argument("--since", default=None, help="ISO date, e.g. 2024-01-01")
    parser.add_argument("--delete-batch", action="store_true")
    args = parser.parse_args()
    main(args.source, args.since, args.delete_batch)
