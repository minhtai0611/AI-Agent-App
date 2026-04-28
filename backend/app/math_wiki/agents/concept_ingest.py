import hashlib
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import ConceptIngestOutput
from app.math_wiki.storage.db import upsert_wiki_unit, get_all_wiki_units


_JSON_REMINDER = (
    "\n\nExtract wiki knowledge units from the above math text. "
    "Return ONLY valid JSON in this exact format: "
    '{"wiki_units": [{"id": "slug", "type": "procedure", "topic": "algebra", '
    '"subtopic": "...", "content": "...", "problem_ids": []}]}'
)


async def concept_ingest(client: AsyncOpenAI, raw_text: str) -> ConceptIngestOutput:
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["CONCEPT_INGEST"]},
            {"role": "user", "content": raw_text + _JSON_REMINDER},
        ],
        max_tokens=1500,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    output = ConceptIngestOutput(**parsed)

    existing_hashes = {
        hashlib.md5(u.content.encode()).hexdigest()
        for u in get_all_wiki_units()
    }

    for unit in output.wiki_units:
        content_hash = hashlib.md5(unit.content.encode()).hexdigest()
        if content_hash not in existing_hashes:
            upsert_wiki_unit(unit)
            existing_hashes.add(content_hash)

    return output
