"""Task 7: Collapse non-canonical type values to the 5 canonical types."""
import argparse
import sqlite3
import sys

sys.path.insert(0, "backend")
from app.math_wiki.taxonomy import TYPE_MAP, CANONICAL_TYPES

DB_PATH = "math_wiki.db"


def main(dry_run: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        "SELECT id, type FROM wiki_units WHERE deleted=0"
    ).fetchall()

    updates: list[tuple[str, str]] = []
    counts: dict[str, int] = {}

    for row in rows:
        t = row["type"]
        if t in CANONICAL_TYPES:
            continue
        canonical = TYPE_MAP.get(t)
        if canonical:
            updates.append((canonical, row["id"]))
            counts[f"{t} → {canonical}"] = counts.get(f"{t} → {canonical}", 0) + 1
        else:
            # Unknown type not in map — collapse to concept as safe default
            updates.append(("concept", row["id"]))
            counts[f"UNKNOWN:{t} → concept"] = counts.get(f"UNKNOWN:{t} → concept", 0) + 1

    print("Type normalization plan:")
    for mapping, cnt in sorted(counts.items()):
        print(f"  {mapping}: {cnt} units")
    print(f"\nTotal updates: {len(updates)}")

    if dry_run:
        print("\nDRY RUN — no changes made.")
        conn.close()
        return

    for new_type, uid in updates:
        conn.execute("UPDATE wiki_units SET type=? WHERE id=?", (new_type, uid))
    conn.commit()

    final = conn.execute(
        "SELECT type, COUNT(*) as cnt FROM wiki_units WHERE deleted=0 GROUP BY type ORDER BY type"
    ).fetchall()
    print("\nType distribution after normalization:")
    for r in final:
        print(f"  {r[0]}: {r[1]}")

    non_canonical = [r[0] for r in final if r[0] not in CANONICAL_TYPES]
    if non_canonical:
        print(f"\nWARNING: non-canonical types still present: {non_canonical}")
    else:
        print("\nAll types are canonical.")

    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
