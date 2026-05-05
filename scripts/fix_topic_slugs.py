"""Task 6: Migrate all non-canonical topic slugs to the 11 canonical topics.
Units whose topic maps to nothing and isn't already canonical are soft-deleted.
Uses a _topic_backup column as rollback source.
"""
import argparse
import sqlite3
import sys

sys.path.insert(0, "backend")
from app.math_wiki.taxonomy import CANONICAL_TOPICS, TOPIC_MAP

DB_PATH = "math_wiki.db"


def main(dry_run: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Ensure backup column exists
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(wiki_units)").fetchall()}
    if "_topic_backup" not in existing_cols:
        conn.execute("ALTER TABLE wiki_units ADD COLUMN _topic_backup TEXT")
        conn.commit()
        print("Added _topic_backup column.")

    # Snapshot current topics
    rows = conn.execute(
        "SELECT id, topic FROM wiki_units WHERE deleted=0"
    ).fetchall()

    updates: list[tuple[str, str]] = []   # (new_topic, id)
    deletes: list[str] = []
    counts: dict[str, int] = {}

    for row in rows:
        topic = row["topic"]
        if topic in CANONICAL_TOPICS:
            continue
        canonical = TOPIC_MAP.get(topic)
        if canonical:
            updates.append((canonical, row["id"]))
            counts[f"{topic} → {canonical}"] = counts.get(f"{topic} → {canonical}", 0) + 1
        else:
            deletes.append(row["id"])
            counts[f"DELETE:{topic}"] = counts.get(f"DELETE:{topic}", 0) + 1

    print("Topic migration plan:")
    for mapping, cnt in sorted(counts.items()):
        print(f"  {mapping}: {cnt} units")
    print(f"\nTotal updates: {len(updates)}, soft-deletes: {len(deletes)}")

    if dry_run:
        print("\nDRY RUN — no changes made.")
        conn.close()
        return

    # Backup existing topics before mutation
    conn.execute(
        "UPDATE wiki_units SET _topic_backup=topic WHERE _topic_backup IS NULL AND deleted=0"
    )
    conn.commit()

    for new_topic, uid in updates:
        conn.execute("UPDATE wiki_units SET topic=? WHERE id=?", (new_topic, uid))
    for uid in deletes:
        conn.execute("UPDATE wiki_units SET deleted=1 WHERE id=?", (uid,))
    conn.commit()

    final = conn.execute(
        "SELECT DISTINCT topic FROM wiki_units WHERE deleted=0 ORDER BY topic"
    ).fetchall()
    print("\nDistinct topics after migration:")
    for r in final:
        print(f"  {r[0]}")

    non_canonical = [r[0] for r in final if r[0] not in CANONICAL_TOPICS]
    if non_canonical:
        print(f"\nWARNING: non-canonical topics still present: {non_canonical}")
    else:
        print("\nAll topics are canonical.")

    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
