"""Generate -> verify -> gate loop for AI-drafted 3D visualization specs.

Same shape as generator.py/verifier.py/orchestrator.py for question generation: the
model only ever proposes a constrained, typed spec (see visualization_schema.py) or
self-abstains — it never authors rendering code, and its numeric params are never
trusted without an independent sympy check. A verification failure or self-abstention
returns {"available": False, "reason": ...} rather than serving unverified content —
abstain over fabricate, the same principle as the question-generation pipeline.
"""
import re
from pathlib import Path

import sympy

from app.agent.router_client import AiRouterClient
from app.agent.verifier import VerificationResult
from app.agent.visualization_schema import validate_spec

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_visualization.md"

MAX_ATTEMPTS = 2

# Cheap keyword hints (Vietnamese + English) fed to the prompt — NOT a hard gate, since
# `topic` is unnormalized free text mixing English competition tags and Vietnamese
# curriculum titles. The model still decides via self-abstention if nothing fits.
TEMPLATE_KEYWORDS = {
    "pyramid": ["hình chóp", "pyramid", "chóp"],
    "prism": ["hình lăng trụ", "lăng trụ", "prism"],
    "sphere_cone": ["hình cầu", "mặt cầu", "hình nón", "hình trụ", "sphere", "cone", "cylinder"],
    "conic_section": ["parabol", "elip", "hyperbol", "ellipse", "parabola", "hyperbola", "conic"],
    "vector_add": ["vector", "véc-tơ", "véctơ"],
    "function_surface": ["mặt cong", "hàm hai biến", "surface"],
    "solid_of_revolution": ["khối tròn xoay", "tròn xoay", "revolution"],
}


class VisualizationShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


def eligible_templates(topic: str, question_text: str) -> list[str]:
    haystack = f"{topic or ''} {question_text or ''}".lower()
    return [name for name, keywords in TEMPLATE_KEYWORDS.items() if any(k.lower() in haystack for k in keywords)]


async def draft_visualization(client: AiRouterClient, question_row: dict, feedback: str | None = None) -> dict:
    """Ask the router for one visualization spec, or an explicit abstention.

    Returns {"available": False, "reason": ...} verbatim on self-abstention, or
    {"available": True, "spec": <validated dict>, "annotation": <str|None>} on a
    well-shaped draft. Raises VisualizationShapeError on malformed JSON — the caller
    (generate_visualization) treats that as a retryable attempt, same as
    generator.DraftShapeError does in the question-generation loop.
    """
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    hints = eligible_templates(question_row.get("topic", ""), question_row.get("question", ""))
    user_prompt = (
        f"Topic: {question_row.get('topic', '')}\n"
        f"Question: {question_row.get('question', '')}\n"
        f"Explanation: {question_row.get('explanation', '')}\n"
    )
    if hints:
        user_prompt += f"Likely-relevant templates (hint, not a requirement): {', '.join(hints)}\n"
    if feedback:
        user_prompt += f"\nYour previous attempt was rejected: {feedback}\nTry a different template or params, or self-abstain.\n"

    result = await client.complete_json(system_prompt, user_prompt)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    annotation = result.get("annotation")
    spec_fields = {k: v for k, v in result.items() if k not in ("available", "annotation", "reason")}
    try:
        spec = validate_spec(spec_fields)
    except Exception as exc:  # pydantic.ValidationError, or a missing "template" key
        raise VisualizationShapeError(str(exc)) from exc

    return {"available": True, "spec": spec.model_dump(), "annotation": annotation}


def _extract_numeric_answer(question_row: dict) -> sympy.Expr | None:
    """Best-effort: parse the stored correct choice as a sympy value, stripping $ delimiters."""
    choices = question_row.get("choices") or []
    correct = question_row.get("correct")
    if correct is None or not (0 <= correct < len(choices)):
        return None
    raw = re.sub(r"\$", "", str(choices[correct])).strip()
    try:
        return sympy.sympify(raw)
    except (sympy.SympifyError, TypeError):
        return None


def _base_area(spec: dict) -> sympy.Expr | None:
    base = spec.get("base")
    if base in ("square", "triangle") and spec.get("base_side") is not None:
        side = sympy.Rational(str(spec["base_side"]))
        if base == "square":
            return side**2
        # equilateral triangle, the only unambiguous "triangle" reading without more params
        return sympy.sqrt(3) / 4 * side**2
    if base == "rectangle" and spec.get("base_dims"):
        w, h = spec["base_dims"]
        return sympy.Rational(str(w)) * sympy.Rational(str(h))
    return None


def verify_visualization(question_row: dict, draft: dict) -> VerificationResult:
    """Exact symbolic checks for volume-bearing templates (pyramid/prism/sphere_cone),
    cross-checked against the question's stored correct answer where that answer is
    itself a matching volume/area value. Templates with no single checkable numeric
    target (conic_section/vector_add/function_surface/solid_of_revolution) get a
    consistency-only check (params parse, bounds are sane) — documented as
    lower-assurance, per the abstain-over-fabricate principle.
    """
    if not draft.get("available"):
        return VerificationResult(False, None, draft.get("reason", "not available"))

    spec = draft["spec"]
    template = spec["template"]
    expected = _extract_numeric_answer(question_row)

    if template == "pyramid":
        area = _base_area(spec)
        if area is None:
            return VerificationResult(False, None, "pyramid: could not determine base area from params")
        volume = sympy.simplify(area * sympy.Rational(str(spec["apex_height"])) / 3)
        if expected is not None and sympy.simplify(volume - expected) != 0:
            return VerificationResult(False, None, f"pyramid volume {volume} does not match stored answer {expected}")
        return VerificationResult(True, None, "verified")

    if template == "prism":
        area = _base_area(spec)
        if area is None:
            return VerificationResult(False, None, "prism: could not determine base area from params")
        volume = sympy.simplify(area * sympy.Rational(str(spec["height"])))
        if expected is not None and sympy.simplify(volume - expected) != 0:
            return VerificationResult(False, None, f"prism volume {volume} does not match stored answer {expected}")
        return VerificationResult(True, None, "verified")

    if template == "sphere_cone":
        r = sympy.Rational(str(spec["radius"]))
        shape = spec["shape"]
        if shape == "sphere":
            volume = sympy.simplify(sympy.Rational(4, 3) * sympy.pi * r**3)
        else:
            h = spec.get("height")
            if h is None:
                return VerificationResult(False, None, f"{shape}: height is required")
            h = sympy.Rational(str(h))
            volume = sympy.simplify((sympy.pi * r**2 * h) / (3 if shape == "cone" else 1))
        if expected is not None and sympy.simplify(volume - expected) != 0:
            return VerificationResult(False, None, f"{shape} volume {volume} does not match stored answer {expected}")
        return VerificationResult(True, None, "verified")

    if template == "conic_section":
        params = spec.get("params", {})
        if not params or any(not isinstance(v, (int, float)) for v in params.values()):
            return VerificationResult(False, None, "conic_section: params must be non-empty numeric values")
        return VerificationResult(True, None, "verified (consistency-only)")

    if template == "vector_add":
        dim = spec["dim"]
        if not spec["vectors"] or any(len(v) != dim for v in spec["vectors"]):
            return VerificationResult(False, None, f"vector_add: every vector must have exactly {dim} components")
        return VerificationResult(True, None, "verified (consistency-only)")

    if template == "function_surface":
        try:
            sympy.sympify(spec["expr"])
        except (sympy.SympifyError, TypeError) as exc:
            return VerificationResult(False, None, f"function_surface: expr does not parse — {exc}")
        xmin, xmax, ymin, ymax = spec["domain"]
        if xmin >= xmax or ymin >= ymax:
            return VerificationResult(False, None, "function_surface: domain bounds are not well-ordered")
        return VerificationResult(True, None, "verified (consistency-only)")

    if template == "solid_of_revolution":
        try:
            sympy.sympify(spec["expr"])
        except (sympy.SympifyError, TypeError) as exc:
            return VerificationResult(False, None, f"solid_of_revolution: expr does not parse — {exc}")
        lower, upper = spec["bounds"]
        if lower >= upper:
            return VerificationResult(False, None, "solid_of_revolution: bounds are not well-ordered")
        return VerificationResult(True, None, "verified (consistency-only)")

    return VerificationResult(False, None, f"unknown template: {template}")


async def generate_visualization(client: AiRouterClient, question_row: dict) -> dict:
    """generate -> verify -> gate. Returns a VisualizationResult-shaped dict, never raises
    for a rejected/unverifiable draft — callers get {"available": False, "reason": ...}
    instead, matching the abstain-over-fabricate contract everywhere else in this feature.
    """
    feedback = None
    last_reason = "no attempts made"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            draft = await draft_visualization(client, question_row, feedback=feedback)
        except VisualizationShapeError as exc:
            last_reason = f"attempt {attempt}: malformed draft — {exc}"
            feedback = str(exc)
            continue

        if not draft.get("available"):
            last_reason = draft.get("reason", "model self-abstained")
            continue

        result = verify_visualization(question_row, draft)
        if result.ok:
            return {"available": True, "spec": draft["spec"], "annotation": draft.get("annotation"), "reason": None}

        last_reason = result.reason
        feedback = result.reason

    return {"available": False, "spec": None, "annotation": None, "reason": last_reason}
