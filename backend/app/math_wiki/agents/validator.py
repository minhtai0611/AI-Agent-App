import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _strip_code_fence
from app.math_wiki.schemas import WikiUnit, SolverOutput, ValidationResult


async def validate(
    client: AsyncOpenAI, solver_output: SolverOutput, context: list[WikiUnit]
) -> ValidationResult:
    settings = get_settings()
    payload = json.dumps({
        "solver_output": solver_output.model_dump(),
        "context": [u.model_dump() for u in context],
    })
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["VALIDATE"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=300,
    )
    content = _strip_code_fence(response.choices[0].message.content or "{}")
    parsed = json.loads(content)
    return ValidationResult(**parsed)
