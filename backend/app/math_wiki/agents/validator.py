import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json
from app.math_wiki.schemas import WikiUnit, SolverOutput, ValidationResult
from app.math_wiki.agents.sympy_verifier import sympy_verify

logger = logging.getLogger(__name__)


async def validate(
    client: AsyncOpenAI,
    solver_output: SolverOutput,
    context: list[WikiUnit],
    problem_text: str = "",
) -> ValidationResult:
    settings = get_settings()
    payload = json.dumps({
        "solver_output": solver_output.model_dump(),
        "context": [u.model_dump() for u in context],
    })
    response = await call_with_retry(
        client,
        model=settings.default_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["VALIDATE"]},
            {"role": "user", "content": payload},
        ],
        max_tokens=300,
    )
    content = _extract_json(response.choices[0].message.content or "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return ValidationResult(valid=False, issues=["validation parse error"])
    llm_result = ValidationResult(**parsed)

    # Deterministic override: if SymPy confirms the answer is wrong, trust it over LLM.
    if problem_text:
        sympy_valid, sympy_issues = sympy_verify(
            problem_text=problem_text,
            final_answer=solver_output.final_answer,
            problem_type=solver_output.problem_type,
        )
        if sympy_valid is False:
            logger.debug("SymPy overrides LLM validation — issues: %s", sympy_issues)
            return ValidationResult(valid=False, issues=llm_result.issues + sympy_issues)

    return llm_result
