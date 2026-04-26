import re


class InsufficientKnowledgeError(ValueError):
    pass


VALID_LABELS: frozenset[str] = frozenset({
    "algebra",
    "geometry",
    "statistics",
    "probability",
    "calculus",
    "trigonometry",
    "combinatorics",
    "number_theory",
})

VALID_CONFIDENCE: frozenset[str] = frozenset({"high", "medium", "low"})


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def _extract_json(text: str) -> str:
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    return text.strip()
