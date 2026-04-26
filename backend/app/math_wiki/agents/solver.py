import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _strip_code_fence, InsufficientKnowledgeError, VALID_CONFIDENCE
from app.math_wiki.schemas import WikiUnit, SolverOutput


async def solve(client: AsyncOpenAI, problem_text: str, context: list[WikiUnit]) -> SolverOutput:
    settings = get_settings()
    payload = json.dumps({
        "problem": problem_text,
        "context": [{"id": u.id, "type": u.type, "content": u.content} for u in context],
    })
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["SOLVE"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=1000,
    )
    content = _strip_code_fence(response.choices[0].message.content or "{}")
    parsed = json.loads(content)

    if parsed.get("result") == "INSUFFICIENT_KNOWLEDGE":
        raise InsufficientKnowledgeError("Insufficient knowledge to solve problem")

    output = SolverOutput(**parsed)

    valid_ids = {u.id for u in context}
    for uid in output.used_knowledge_ids:
        if uid not in valid_ids:
            raise ValueError(f"Hallucinated knowledge ID: {uid!r}")

    if output.confidence not in VALID_CONFIDENCE:
        raise ValueError(f"Invalid confidence: {output.confidence!r}")

    return output
