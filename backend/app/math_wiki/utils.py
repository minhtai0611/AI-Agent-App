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
    "complex_numbers",
    "sequences",
    "vectors",
    "functions",
    "differential_equations",
    "linear_algebra",
    "multivariable_calculus",
})

VALID_CONFIDENCE: frozenset[str] = frozenset({"high", "medium", "low"})


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def _fix_backslashes(text: str) -> str:
    """Replace bare LaTeX backslashes (e.g. \frac) with escaped form so JSON parses."""
    # Only fix backslashes that are NOT already valid JSON escape sequences
    return re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', text)


def _extract_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return _fix_backslashes(match.group(0))
    return _fix_backslashes(text.strip())
