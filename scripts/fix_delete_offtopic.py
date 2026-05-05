"""Task 1: Soft-delete units with topic IN (physics, thermodynamics, mechanics)."""
import argparse
import sqlite3
import sys

DB_PATH = "math_wiki.db"
OFF_TOPIC = ("physics", "thermodynamics", "mechanics")


def main(dry_run: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        f"SELECT id, topic, subtopic, content FROM wiki_units "
        f"WHERE topic IN ({','.join('?'*len(OFF_TOPIC))}) AND deleted=0",
        OFF_TOPIC,
    ).fetchall()

    print(f"Found {len(rows)} off-topic units to soft-delete:")
    for r in rows:
        print(f"  [{r['topic']}] {r['id']}: {r['content'][:70]!r}")

    if dry_run:
        print("\nDRY RUN — no changes made.")
        return

    ids = [r["id"] for r in rows]
    conn.execute(
        f"UPDATE wiki_units SET deleted=1 WHERE id IN ({','.join('?'*len(ids))})",
        ids,
    )
    conn.commit()

    before = conn.execute(
        f"SELECT COUNT(*) FROM wiki_units WHERE topic IN ({','.join('?'*len(OFF_TOPIC))}) AND deleted=0",
        OFF_TOPIC,
    ).fetchone()[0]
    after_deleted = conn.execute("SELECT COUNT(*) FROM wiki_units WHERE deleted=1").fetchone()[0]

    print(f"\nDone. Off-topic active rows remaining: {before} (expected 0)")
    print(f"Total deleted rows: {after_deleted}")
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
