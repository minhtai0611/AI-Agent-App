import hashlib
import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json, VALID_LABELS
from app.math_wiki.schemas import ConceptIngestOutput, WikiUnit
from app.math_wiki.storage.db import upsert_wiki_unit, get_all_wiki_units

logger = logging.getLogger(__name__)

# Map common model-generated topics to VALID_LABELS
_TOPIC_ALIASES: dict[str, str] = {
    "differential_equations": "calculus",
    "differential equations": "calculus",
    "ode": "calculus",
    "pde": "calculus",
    "integration": "calculus",
    "differentiation": "calculus",
    "linear_algebra": "algebra",
    "linear algebra": "algebra",
    "discrete_mathematics": "combinatorics",
    "discrete mathematics": "combinatorics",
    "sequences": "algebra",
    "series": "calculus",
    "vectors": "geometry",
    "matrices": "algebra",
}

_ENRICH_REMINDER = (
    "\n\nGenerate wiki knowledge units needed to solve the above problem. "
    "Return ONLY valid JSON: "
    '{"wiki_units": [{"id": "slug", "type": "procedure", "topic": "calculus", '
    '"subtopic": "...", "content": "...", "problem_ids": []}]}'
)

_MAX_UNITS = 6


async def auto_enrich(
    client: AsyncOpenAI, problem_text: str
) -> tuple[int, list[str], list[WikiUnit]]:
    """Generate and store wiki units for a problem the solver couldn't handle.

    Returns (new_unit_count, subtopics_added, new_wiki_units).
    """
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["AUTO_ENRICH"]},
            {"role": "user", "content": problem_text + _ENRICH_REMINDER},
        ],
        max_tokens=1500,
    )
    raw = response.choices[0].message.content or "{}"
    content = _extract_json(raw)
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("Auto-enricher returned malformed JSON")
        return 0, [], []

    try:
        output = ConceptIngestOutput(**parsed)
    except Exception as exc:
        logger.warning("Auto-enricher schema error: %s", exc)
        return 0, [], []

    # Normalize topic aliases and validate
    for unit in output.wiki_units:
        if unit.topic not in VALID_LABELS:
            normalized = _TOPIC_ALIASES.get(unit.topic.lower())
            if normalized:
                logger.debug("Auto-enricher: normalized topic %r → %r", unit.topic, normalized)
                unit.topic = normalized

    valid_units = [u for u in output.wiki_units if u.topic in VALID_LABELS]
    dropped = len(output.wiki_units) - len(valid_units)
    if dropped:
        logger.warning("Auto-enricher: dropped %d unit(s) with unrecognized topic", dropped)
    valid_units = valid_units[:_MAX_UNITS]

    if not valid_units:
        return 0, [], []

    # MD5 dedup against existing corpus
    existing_hashes = {
        hashlib.md5(u.content.encode()).hexdigest()
        for u in get_all_wiki_units()
    }
    new_units: list[WikiUnit] = []
    for unit in valid_units:
        content_hash = hashlib.md5(unit.content.encode()).hexdigest()
        if content_hash not in existing_hashes:
            upsert_wiki_unit(unit, source="auto")
            existing_hashes.add(content_hash)
            new_units.append(unit)

    subtopics = list({u.subtopic for u in new_units})
    logger.info("Auto-enriched %d new unit(s): %s", len(new_units), subtopics)
    return len(new_units), subtopics, new_units
