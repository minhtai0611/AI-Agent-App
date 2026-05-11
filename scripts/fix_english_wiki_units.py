"""
Translate English wiki units (ingested via PROMPT_INGEST before the language rule was added)
into Vietnamese.

Targets: wiki_units where source = 'exam_upload' AND content has no Vietnamese diacritics.
Uses Haiku for translation (cheap, fast). Calls upsert_wiki_unit so version history and
embeddings are updated automatically.

Usage:
    PYTHONPATH=backend python3 scripts/fix_english_wiki_units.py --dry-run
    PYTHONPATH=backend python3 scripts/fix_english_wiki_units.py --limit 20
    PYTHONPATH=backend python3 scripts/fix_english_wiki_units.py
"""
import asyncio
import argparse
import logging
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Any Vietnamese character — if absent the content is treated as English.
_VI_RE = re.compile(
    r"[àáảãạăắặẳẵằâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ"
    r"ÀÁẢÃẠĂẮẶẲẴẰÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]"
)

_TRANSLATE_SYSTEM = """\
You are a Vietnamese math translator. Translate the given English math knowledge unit into Vietnamese.

Rules:
- Output ONLY the translated content string — no JSON, no labels, no explanation.
- Preserve ALL math expressions exactly: keep $...$ and $$...$$ delimiters, LaTeX commands, and variable names unchanged.
- Write all prose, procedure names, and explanations in Vietnamese.
- Keep the same structure and level of detail as the original.
- Do NOT add any introductory phrase like "Dưới đây là..." — start the content directly."""


async def _translate(client, content: str, settings) -> str:
    from app.agent.core import call_with_retry
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": _TRANSLATE_SYSTEM},
            {"role": "user", "content": content},
        ],
        max_tokens=1024,
    )
    translated = (response.choices[0].message.content or "").strip()
    if not translated:
        raise ValueError("Empty translation response")
    return translated


async def main(dry_run: bool, limit: int | None, source_filter: str) -> None:
    import asyncpg
    from app.config import get_settings
    from app.dependencies import get_ai_client
    from app.math_wiki.storage import pg_db
    from app.math_wiki.schemas import WikiUnit

    settings = get_settings()
    if not settings.database_url:
        logger.error("DATABASE_URL is not set — cannot connect to PostgreSQL")
        sys.exit(1)

    pool = await asyncpg.create_pool(settings.database_url)
    client = get_ai_client()

    # Fetch candidate units
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, type, topic, subtopic, content, problem_ids, source, source_url "
            "FROM wiki_units WHERE deleted = false AND source = $1 ORDER BY id",
            source_filter,
        )

    logger.info("Fetched %d units from source '%s'", len(rows), source_filter)

    # Filter to English-only
    english_units = [r for r in rows if not _VI_RE.search(r["content"])]
    logger.info("%d units have no Vietnamese characters (English content)", len(english_units))

    if limit:
        english_units = english_units[:limit]
        logger.info("Processing first %d (--limit)", limit)

    if dry_run:
        logger.info("DRY RUN — showing first 5 units that would be translated:")
        for r in english_units[:5]:
            logger.info("  [%s] %s", r["id"], r["content"][:120])
        logger.info("Total would translate: %d", len(english_units))
        await pool.close()
        return

    ok = 0
    failed = 0
    for r in english_units:
        uid = r["id"]
        original = r["content"]
        try:
            translated = await _translate(client, original, settings)
            unit = WikiUnit(
                id=uid,
                type=r["type"],
                topic=r["topic"],
                subtopic=r["subtopic"] or "",
                content=translated,
                problem_ids=[] if r["problem_ids"] is None else __import__("json").loads(r["problem_ids"]),
            )
            await pg_db.upsert_wiki_unit(
                pool, unit,
                source=r["source"],
                source_url=r["source_url"],
                editor="fix_english_wiki_units",
                reason="Translated English content to Vietnamese (PROMPT_INGEST language rule was missing)",
            )
            logger.info("✓ %s", uid)
            ok += 1
        except Exception as exc:
            logger.warning("✗ %s — %s", uid, exc)
            failed += 1

    logger.info("\nDone. Translated: %d  Failed: %d  Skipped (already VI): %d",
                ok, failed, len(rows) - len(english_units))
    await pool.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Translate English wiki units to Vietnamese")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change, no writes")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N units")
    parser.add_argument("--source", default="exam_upload", help="Source filter (default: exam_upload)")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run, limit=args.limit, source_filter=args.source))
