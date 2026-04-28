import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.agent.core import call_with_retry
from app.math_wiki.prompts import MODE_PROMPTS
from app.math_wiki.utils import _extract_json, VALID_LABELS


async def classify_problem(client: AsyncOpenAI, problem_text: str) -> str:
    settings = get_settings()
    user_msg = (
        f"{problem_text}\n\n"
        "Respond ONLY with valid JSON in this exact format: "
        '{"label": "<category>"} '
        "where category is one of: algebra, geometry, statistics, probability, "
        "calculus, trigonometry, combinatorics, number_theory."
    )
    response = await call_with_retry(
        client,
        model=settings.haiku_model,
        messages=[
            {"role": "system", "content": MODE_PROMPTS["CLASSIFY"]},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=50,
    )
    raw = response.choices[0].message.content or ""
    content = _extract_json(raw)
    try:
        parsed = json.loads(content)
        label = parsed.get("label", "")
    except json.JSONDecodeError:
        label = ""

    keyword_map = {
            "calculus": [
                "calculus", "derivative", "integral", "integrate", "differentiat",
                "limit", r"\int", "antiderivative", "indefinite", "definite",
                "dy/dx", "d/dx", "partial", "gradient", "divergence", "curl",
                "differential equation", "ode", "pde", "y''", "y'",
            ],
            "trigonometry": [
                "trigonometry", "trigonometric", "sine", "cosine", "tangent",
                r"\sin", r"\cos", r"\tan", r"\cot", r"\sec", r"\csc",
                "sin(", "cos(", "tan(", "arcsin", "arccos", "arctan",
            ],
            "algebra": ["algebra", "equation", "quadratic", "polynomial", "linear", "variable"],
            "geometry": ["geometry", "geometric", "triangle", "circle", "area", "perimeter", "volume", "angle"],
            "statistics": ["statistic", "mean", "median", "mode", "variance", "deviation", "frequency"],
            "probability": ["probability", "chance", "likelihood", "random", "event"],
            "combinatorics": ["combinatoric", "permutation", "combination", "factorial", "arrange"],
            "number_theory": ["number theory", "prime", "divisor", "modular", "gcd", "lcm"],
        }

    # Always scan the question text — the model frequently mislabels calculus/trig as algebra.
    # A keyword hit on the question overrides the model's label.
    question_lower = problem_text.lower()
    keyword_label = next(
        (lbl for lbl, kws in keyword_map.items() if any(kw in question_lower for kw in kws)),
        None,
    )
    if label not in VALID_LABELS:
        label = keyword_label or "algebra"
    elif keyword_label and keyword_label != label:
        # Question text strongly signals a different category — trust the question.
        label = keyword_label
    return label
