import hashlib
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import ConceptIngestOutput
from app.math_wiki.storage import pg_db
from app.math_wiki.storage.pg_vectors import is_near_duplicate_pg
from app.metrics import inc_wiki_units_added
from app.math_wiki.taxonomy import CANONICAL_TOPICS, TOPIC_MAP, CANONICAL_TYPES, TYPE_MAP

_VALID_TOPICS = ", ".join(sorted(CANONICAL_TOPICS))
_VALID_TYPES = ", ".join(sorted(CANONICAL_TYPES))

_JSON_REMINDER = (
    "\n\nExtract wiki knowledge units from the above math text. "
    "Return ONLY valid JSON in this exact format: "
    '{"wiki_units": [{"id": "slug", "type": "concept", "topic": "statistics", '
    '"subtopic": "...", "content": "...", "problem_ids": []}]}\n'
    f"topic MUST be one of: {_VALID_TOPICS}\n"
    f"type MUST be one of: {_VALID_TYPES}\n"
    "IMPORTANT: Write math expressions in plain text (e.g. 'x^2 + bx + c = 0'), "
    "NOT LaTeX backslash notation. Backslashes break JSON."
)


def _normalize_unit(unit, fallback_topic: str | None) -> None:
    topic = unit.topic
    if topic not in CANONICAL_TOPICS:
        topic = TOPIC_MAP.get(topic) or TOPIC_MAP.get(topic.lower().replace(" ", "_"))
    if topic not in CANONICAL_TOPICS:
        topic = fallback_topic
    if topic:
        unit.topic = topic

    unit_type = unit.type
    if unit_type not in CANONICAL_TYPES:
        unit.type = TYPE_MAP.get(unit_type, "concept")


async def concept_ingest(
    client: AsyncOpenAI,
    raw_text: str,
    pool=None,
    source: str = "manual",
    source_url: str | None = None,
    fallback_topic: str | None = None,
) -> ConceptIngestOutput:
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["CONCEPT_INGEST"]},
            {"role": "user", "content": raw_text + _JSON_REMINDER},
        ],
        max_tokens=4096,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    output = ConceptIngestOutput(**parsed)

    if pool:
        existing_hashes = await pg_db.get_all_content_hashes(pool)
        for unit in output.wiki_units:
            _normalize_unit(unit, fallback_topic)
            if unit.topic not in CANONICAL_TOPICS:
                logger.warning("concept_ingest: skipped %s — invalid topic %r (not in CANONICAL_TOPICS)", unit.id, unit.topic)
                continue
            content_hash = hashlib.md5(unit.content.encode()).hexdigest()
            if content_hash in existing_hashes:
                logger.info("concept_ingest: skipped %s — duplicate content hash", unit.id)
                continue
            if await is_near_duplicate_pg(pool, unit.content):
                logger.info("concept_ingest: skipped %s — near-duplicate by embedding (similarity>0.92)", unit.id)
                continue
            await pg_db.upsert_wiki_unit(pool, unit, source=source, source_url=source_url)
            existing_hashes.add(content_hash)
            inc_wiki_units_added()

    return output
