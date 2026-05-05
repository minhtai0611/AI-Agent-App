"""Task 2: Strip markdown bold (**text**) and HTML-LaTeX artifacts.
Converts r'\(...\)' to '$...$', r'\[...\]' to '$$...$$', and '**text**' to 'text'.
Also soft-deletes any unit whose content contains 'References' boilerplate.
"""
import argparse
import re
import sqlite3


DB_PATH = "math_wiki.db"

REFERENCES_PATTERN = re.compile(r"\bReferences\b")


def clean_content(text: str) -> str:
    # \(...\) → $...$
    text = re.sub(r"\\\((.+?)\\\)", r"$\1$", text, flags=re.DOTALL)
    # \[...\] → $$...$$
    text = re.sub(r"\\\[(.+?)\\\]", r"$$\1$$", text, flags=re.DOTALL)
    # **text** → text
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    return text


def main(dry_run: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        "SELECT id, content FROM wiki_units WHERE deleted=0"
    ).fetchall()

    updates: list[tuple[str, str]] = []   # (new_content, id)
    deletes: list[str] = []

    for row in rows:
        content = row["content"]
        if REFERENCES_PATTERN.search(content):
            deletes.append(row["id"])
            continue
        cleaned = clean_content(content)
        if cleaned != content:
            updates.append((cleaned, row["id"]))

    print(f"Units to clean: {len(updates)}")
    for new_content, uid in updates:
        old = conn.execute("SELECT content FROM wiki_units WHERE id=?", (uid,)).fetchone()["content"]
        print(f"  {uid}:")
        print(f"    BEFORE: {old[:100]!r}")
        print(f"    AFTER:  {new_content[:100]!r}")

    print(f"\nUnits to soft-delete (References boilerplate): {len(deletes)}")
    for uid in deletes:
        print(f"  {uid}")

    if dry_run:
        print("\nDRY RUN — no changes made.")
        conn.close()
        return

    for new_content, uid in updates:
        conn.execute("UPDATE wiki_units SET content=? WHERE id=?", (new_content, uid))
    for uid in deletes:
        conn.execute("UPDATE wiki_units SET deleted=1 WHERE id=?", (uid,))
    conn.commit()

    remaining_bold = conn.execute(
        "SELECT COUNT(*) FROM wiki_units WHERE content LIKE '%**%' AND deleted=0"
    ).fetchone()[0]
    remaining_latex = conn.execute(
        "SELECT COUNT(*) FROM wiki_units WHERE content LIKE '%\\(%' AND deleted=0"
    ).fetchone()[0]
    print(f"\nDone. Remaining '**' units: {remaining_bold} (target 0)")
    print(f"Remaining '\\(' units: {remaining_latex} (target 0)")
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(args.dry_run)
