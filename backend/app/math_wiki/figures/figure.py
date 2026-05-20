"""Universal GeoGebra figure generator — one LLM call, all math domains."""
import logging
from app.math_wiki.schemas import FigureOutput, SolverOutput

logger = logging.getLogger(__name__)

_PROMPT = """\
You are a GeoGebra Classic expert. Read the math problem below and write GeoGebra Classic commands that draw an accurate diagram for it.

Output exactly NO_FIGURE (nothing else) when the problem has no geometric object to draw — e.g. pure arithmetic, number theory, or combinatorics counting problems.

══ GEOGEBRA CLASSIC 5 — VALID COMMANDS ══
Point:                P = (x, y)
Segment:              Segment(A, B)
Line through 2 pts:   l = Line(A, B)
Perp foot (ONLY way): h = PerpendicularLine(P, l)  then  D = Intersect(h, l)
Intersect 2 lines:    H = Intersect(l1, l2)             ← never nest Line() inside
Circle (center+pt):   c = Circle(M, A)
Circumscribed circle (ONLY way): pb1=PerpendicularBisector(A,B)  pb2=PerpendicularBisector(B,C)  O=Intersect(pb1,pb2)  c=Circle(O,A)
Incircle:             ic = Incircle(A, B, C)
Midpoint:             M = Midpoint(A, B)
Polygon:              poly = Polygon(A, B, C, D)
Angle bisector:       b = AngleBisector(B, A, C)
Perp bisector:        pb = PerpendicularBisector(A, B)
Function:             f(x) = <expr>
Tangent line:         Tangent(f, (x0, f(x0)))
Integral region:      Integral(f, a, b)
Vector:               v = Vector((0,0), (3,4))
Hide object:          HideObject(obj)
Color / fill:         SetColor(obj, "SteelBlue")  /  SetFilling(obj, 0.15)

══ BANNED COMMANDS (cause runtime errors — never use) ══
PerpendicularFoot   Circumcircle   CircumscribedCircle   Circumcenter   Foot

══ RULES ══
1. Every name MUST be assigned (name = …) before it is used anywhere else.
2. For any perpendicular foot from point P to line l: use PerpendicularLine then Intersect (two separate lines).
3. For circumscribed circles: use two PerpendicularBisectors, Intersect them for center, then Circle.
4. After using auxiliary lines: hide them with HideObject(obj).
5. Draw only what the problem explicitly mentions or needs for the proof — nothing decorative.
6. Do NOT include any ZoomIn or ZoomOut command — the viewer auto-fits.
7. Your ENTIRE response must be GeoGebra commands — no preamble, no explanation, no "Let me…" sentences. The very first character must start a command.

══ PROBLEM ══
{problem_text}

{solver_hint}
{extra_hint}"""


import re as _re

# GeoGebra commands either contain '=' (assignment/relation) or start with a
# known function name. Lines that are plain English sentences are preamble text
# the LLM accidentally included — drop them silently.
_CMD_RE = _re.compile(
    r'^[A-Za-z_][A-Za-z0-9_]*\s*='                # assignment: Name = …
    r'|^[A-Za-z_][A-Za-z0-9_]*\([a-zA-Z]\)\s*='   # function def: f(x) = …
    r'|^\s*(?:Segment|Line|Circle|Circumcircle|Incircle|Midpoint|Polygon|'
    r'AngleBisector|PerpendicularBisector|PerpendicularLine|PerpendicularFoot|Intersect|'
    r'Tangent|Integral|Root|Asymptote|Vector|Reflect|Rotate|Translate|'
    r'HideObject|ShowObject|SetColor|SetFilling|SetVisible|SetLineThickness|'
    r'ZoomIn|ZoomOut)\s*[\(\[]',
    _re.IGNORECASE,
)

def _filter_commands(raw: str) -> str:
    """Drop lines that are not GeoGebra commands (e.g. LLM preamble text)."""
    kept = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if _CMD_RE.match(stripped):
            kept.append(stripped)
        else:
            logger.debug("Filtered non-command line: %r", stripped[:80])
    return "\n".join(kept)


# Patterns for commands unsupported by GeoGebra Classic 5
_PERP_FOOT_RE = _re.compile(
    r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:PerpendicularFoot|Foot)\s*\(([^,]+),\s*([^)]+)\)\s*$',
    _re.IGNORECASE,
)
_CIRCUMCIRCLE_RE = _re.compile(
    r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:Circumcircle|CircumscribedCircle)\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s*$',
    _re.IGNORECASE,
)
_CIRCUMCENTER_RE = _re.compile(
    r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Circumcenter\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s*$',
    _re.IGNORECASE,
)

def _fix_unsupported_commands(commands: str) -> str:
    """
    Replace GeoGebra commands that crash in Classic 5 with working equivalents.

    PerpendicularFoot(P, l)        → PerpendicularLine + Intersect + HideObject
    Circumcircle(A, B, C)          → two PerpendicularBisectors + Intersect + Circle
    Circumcenter(A, B, C)          → two PerpendicularBisectors + Intersect
    """
    out = []
    for line in commands.splitlines():
        s = line.strip()
        if not s:
            continue

        m = _PERP_FOOT_RE.match(s)
        if m:
            name, pt, ln = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            aux = f"_aux_h_{name}"
            out += [
                f"{aux} = PerpendicularLine({pt}, {ln})",
                f"{name} = Intersect({aux}, {ln})",
                f"HideObject({aux})",
            ]
            logger.debug("Rewrote PerpendicularFoot(%s,%s) → 3 commands", pt, ln)
            continue

        m = _CIRCUMCIRCLE_RE.match(s)
        if m:
            name, a, b, c = m.group(1).strip(), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
            pb1, pb2, ctr = f"_aux_pb1_{name}", f"_aux_pb2_{name}", f"_aux_O_{name}"
            out += [
                f"{pb1} = PerpendicularBisector({a}, {b})",
                f"{pb2} = PerpendicularBisector({b}, {c})",
                f"{ctr} = Intersect({pb1}, {pb2})",
                f"{name} = Circle({ctr}, {a})",
                f"HideObject({pb1})",
                f"HideObject({pb2})",
            ]
            logger.debug("Rewrote Circumcircle(%s,%s,%s) → 6 commands", a, b, c)
            continue

        m = _CIRCUMCENTER_RE.match(s)
        if m:
            name, a, b, c = m.group(1).strip(), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
            pb1, pb2 = f"_aux_pb1_{name}", f"_aux_pb2_{name}"
            out += [
                f"{pb1} = PerpendicularBisector({a}, {b})",
                f"{pb2} = PerpendicularBisector({b}, {c})",
                f"{name} = Intersect({pb1}, {pb2})",
                f"HideObject({pb1})",
                f"HideObject({pb2})",
            ]
            logger.debug("Rewrote Circumcenter(%s,%s,%s) → 5 commands", a, b, c)
            continue

        out.append(s)
    return "\n".join(out)


async def generate_figure(
    client,
    question: str,
    label: str,
    solver_output: SolverOutput,
) -> FigureOutput | None:
    """Return FigureOutput or None (for NO_FIGURE). Never raises."""
    from app.config import get_settings
    settings = get_settings()

    solver_hint = ""
    if solver_output.steps:
        preview = "\n".join(f"  {s}" for s in solver_output.steps[:4])
        solver_hint = f"SOLUTION CONTEXT (use to understand the problem, do not copy verbatim):\n{preview}"

    MAX_RETRIES = 2
    extra_hint = ""

    for attempt in range(MAX_RETRIES + 1):
        try:
            prompt = _PROMPT.format(
                problem_text=question,
                solver_hint=solver_hint,
                extra_hint=f"\nPrevious attempt failed: {extra_hint}\nFix those issues." if extra_hint else "",
            )

            resp = await client.chat.completions.create(
                model=settings.default_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=900,
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()

            if raw == "NO_FIGURE":
                return None

            # Strip markdown fences if LLM wrapped output
            if raw.startswith("```"):
                raw = "\n".join(line for line in raw.split("\n") if not line.startswith("```"))

            commands = _filter_commands(raw.strip())
            if not commands:
                raise ValueError("LLM returned empty GeoGebra commands")

            commands = _fix_unsupported_commands(commands)
            return FigureOutput(type="geogebra", data=commands)

        except Exception as exc:
            if attempt == MAX_RETRIES:
                logger.warning("Figure generation failed after %d attempts: %s", MAX_RETRIES + 1, exc)
                return None
            extra_hint = str(exc)
            logger.debug("Figure generation attempt %d failed: %s", attempt + 1, exc)
