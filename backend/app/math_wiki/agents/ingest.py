import hashlib
import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import IngestOutput
from app.math_wiki.storage.db import upsert_problem, upsert_wiki_unit, get_all_content_hashes
from app.metrics import inc_wiki_units_added


async def ingest_exam(
    client: AsyncOpenAI,
    raw_text: str,
    source: str = "exam_upload",
    source_url: str | None = None,
) -> IngestOutput:
    settings = get_settings()
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["INGEST"]},
            {"role": "user", "content": raw_text},
        ],
        max_tokens=2000,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    output = IngestOutput(**parsed)

    # Validate: each problem must have >= 2 wiki units
    unit_map: dict[str, set[str]] = {}
    for unit in output.wiki_units:
        for pid in unit.problem_ids:
            unit_map.setdefault(pid, set()).add(unit.id)

    for problem in output.problems:
        if len(unit_map.get(problem.problem_id, set())) < 2:
            raise ValueError(
                f"Problem {problem.problem_id} has fewer than 2 wiki units"
            )

    # Dedup wiki units by content hash
    existing_hashes = get_all_content_hashes()

    for unit in output.wiki_units:
        content_hash = hashlib.md5(unit.content.encode()).hexdigest()
        if content_hash not in existing_hashes:
            upsert_wiki_unit(unit, source=source, source_url=source_url)
            existing_hashes.add(content_hash)
            inc_wiki_units_added()

    for problem in output.problems:
        upsert_problem(problem)

    return output
