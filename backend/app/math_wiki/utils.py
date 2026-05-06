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
    text = re.sub(r'^```(?:json)?\s*', '', text.strip())
    text = re.sub(r'\s*```$', '', text)
    # Walk characters to find the last well-formed top-level {…} span.
    # Greedy regex would match first-{ to last-}, capturing invalid multi-object spans.
    last_start = last_end = -1
    depth = 0
    in_string = False
    escape = False
    start = -1
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                last_start, last_end = start, i + 1
    if last_start != -1:
        return _fix_backslashes(text[last_start:last_end])
    return _fix_backslashes(text.strip())
