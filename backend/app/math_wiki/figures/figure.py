"""Universal GeoGebra figure generator — one LLM call, all math domains."""
import logging
import math
from app.math_wiki.schemas import FigureOutput, SolverOutput

logger = logging.getLogger(__name__)

_PROMPT = """\
You are a GeoGebra Classic expert. Read the math problem below and write GeoGebra Classic commands that draw an accurate diagram for it.

Output exactly NO_FIGURE (nothing else) when the problem has no geometric object to draw — e.g. pure arithmetic, number theory, or combinatorics counting problems.

══ GEOGEBRA CLASSIC 5 — 2D COMMANDS ══
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
Multiple functions:   f(x) = <expr1>    (then on separate lines) g(x) = <expr2>   h(x) = <expr3>
Tangent line:         t = Tangent(f, (x0, f(x0)))
Integral region:      I = Integral(f, a, b)
Vector:               v = Vector((0,0), (3,4))
Hide object:          HideObject(obj)
Color / fill:         SetColor(obj, "SteelBlue")  /  SetFilling(obj, 0.15)

══ 3D COMMANDS — use for pyramids, prisms, cuboids, spheres, cones, cylinders ══
3D Point:             A = (x, y, z)           ← 3 coordinates; place base face in z=0 plane
Segment (3D):         e = Segment(A, B)       ← same command works in 3D
Polygon (face):       base = Polygon(A, B, C, D)
Pyramid:              p = Pyramid(base, S)    ← base polygon + apex point S
Prism:                pr = Prism(base, A1)    ← base polygon + top-face image of 1st vertex
  Example prism: A=(0,0,0) B=(2,0,0) C=(1,1.73,0) A1=(0,0,3) base=Polygon(A,B,C) pr=Prism(base,A1)
Cube:                 cu = Cube(A, B)         ← A and B are adjacent base vertices
Sphere:               sp = Sphere(M, r)       ← center M + radius (number)
Cone:                 cn = Cone(A, B, r)      ← apex A, base center B, base radius r
Cylinder:             cy = Cylinder(A, B, r)  ← bottom center A, top center B, radius r
Plane:                pl = Plane(A, B, C)     ← plane through 3 points
Cross-section:        cs = IntersectPath(solid, pl)  ← polygon cross-section of a solid with a plane

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
8. For function graphs, ALWAYS use the named function form: f(x) = <expr>. NEVER write y = <expr> — that creates an implicit curve object, not a function. Use f, g, h, p, q for multiple functions.
9. For 3D geometry (hình chóp, lăng trụ, hình hộp, hình cầu…): use 3D coordinates (x,y,z). Place the base face in z=0. Compute all vertex coordinates numerically from the given edge lengths before writing any command. A right pyramid S.ABCD with square base side a and SA⊥base: A=(0,0,0), B=(a,0,0), C=(a,a,0), D=(0,a,0), S=(a/2,a/2,h). A right prism: base in z=0, corresponding top vertices at z=height.

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
    r'Pyramid|Prism|Cube|Sphere|Cone|Cylinder|Plane|IntersectPath|'
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


_FUNC_DEF_RE = _re.compile(r'^[a-zA-Z]\(x\)\s*=', _re.MULTILINE)
_INTEGRAL_RANGE_RE = _re.compile(r'Integral\s*\([^,]+,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\)', _re.IGNORECASE)
_TRIG_FUNC_RE = _re.compile(r'\b(?:sin|cos|tan|cot)\s*\(', _re.IGNORECASE)

_LABEL_CAPTION: dict[str, str] = {
    "calculus": "Đồ thị hàm số",
    "functions": "Đồ thị hàm số",
    "algebra": "Hình minh họa đại số",
    "geometry": "Hình minh họa hình học",
    "hình học": "Hình minh họa hình học",
    "hinh_hoc": "Hình minh họa hình học",
    "plane_geometry": "Hình minh họa hình học",
    "coordinate_geometry": "Hình tọa độ",
    "vector": "Hình vectơ",
    "trigonometry": "Đồ thị lượng giác",
    "3d": "Hình không gian",
    "solid_geometry": "Hình không gian",
    "statistics": "Biểu đồ thống kê",
}


def _infer_viewport(label: str, commands: str) -> "dict | None":
    """Return {xmin, xmax, ymin, ymax} viewport hint for function graphs; None for geometry."""
    if not _FUNC_DEF_RE.search(commands):
        return None
    m = _INTEGRAL_RANGE_RE.search(commands)
    if m:
        try:
            lo, hi = float(m.group(1)), float(m.group(2))
            pad = max(0.5, abs(hi - lo) * 0.1)
            return {"xmin": round(lo - pad, 2), "xmax": round(hi + pad, 2), "ymin": -1, "ymax": None}
        except ValueError:
            pass
    if _TRIG_FUNC_RE.search(commands):
        return {"xmin": -7, "xmax": 7, "ymin": -3, "ymax": 3}
    return {"xmin": -5, "xmax": 5, "ymin": -5, "ymax": 10}


def _infer_caption(label: str) -> str:
    return _LABEL_CAPTION.get(label, "Hình minh họa")


_PT3D_RE = _re.compile(
    r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)',
)

def _parse_3d_points(commands: str) -> dict[str, tuple[float, float, float]]:
    pts: dict[str, tuple[float, float, float]] = {}
    for line in commands.splitlines():
        m = _PT3D_RE.match(line.strip())
        if m:
            try:
                pts[m.group(1)] = (float(m.group(2)), float(m.group(3)), float(m.group(4)))
            except ValueError:
                pass
    return pts


def _dist3(a, b):
    return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))


def _vec3(a, b):
    return (b[0] - a[0], b[1] - a[1], b[2] - a[2])


_EDGE_RE = _re.compile(
    r'(?:cạnh|AB|BC|CD|SA|SB|SC|SD|a\s*=|b\s*=|c\s*=|h\s*=)[^\d]*(\d+(?:[.,]\d+)?)',
    _re.IGNORECASE,
)
_SA_PERP_RE = _re.compile(
    r'SA\s*(?:⊥|vuông\s*góc)\s*(?:đáy|base|ABCD|ABC|\(ABCD\)|\(ABC\))',
    _re.IGNORECASE,
)


def _check_3d_constraints(problem: str, commands: str) -> str | None:
    """Return an error hint string if geometric constraints are violated, else None."""
    pts = _parse_3d_points(commands)
    if not pts:
        return None

    issues: list[str] = []

    # Check SA⊥base: apex S must lie directly above the base centroid
    if _SA_PERP_RE.search(problem):
        s = pts.get('S')
        base_pts = {k: v for k, v in pts.items() if k != 'S' and not k.startswith('_')}
        if s and len(base_pts) >= 3:
            base_z_ok = all(abs(v[2]) < 0.05 for v in base_pts.values())
            if base_z_ok:
                cx = sum(v[0] for v in base_pts.values()) / len(base_pts)
                cy = sum(v[1] for v in base_pts.values()) / len(base_pts)
                lateral_offset = math.sqrt((s[0] - cx) ** 2 + (s[1] - cy) ** 2)
                if lateral_offset > 0.15:
                    issues.append(
                        f"SA⊥base violated: apex S=({s[0]:.2f},{s[1]:.2f},{s[2]:.2f}) "
                        f"is offset {lateral_offset:.3f} from base centroid ({cx:.2f},{cy:.2f}). "
                        f"Place S directly above the base centroid at ({cx:.2f},{cy:.2f},h)."
                    )

    if not issues:
        return None
    return " | ".join(issues)


_PT2D_RE = _re.compile(
    r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)',
)
_RIGHT_ANGLE_RE = _re.compile(
    r'vuông\s*(?:tại|góc\s*(?:tại|ở))\s*([A-Z])',
    _re.IGNORECASE,
)
_PARALLELOGRAM_RE = _re.compile(r'hình\s*bình\s*hành', _re.IGNORECASE)
_SQUARE_RE = _re.compile(r'hình\s*vuông', _re.IGNORECASE)


def _parse_2d_points(commands: str) -> "dict[str, tuple[float, float]]":
    pts: "dict[str, tuple[float, float]]" = {}
    for line in commands.splitlines():
        m = _PT2D_RE.match(line.strip())
        if m:
            try:
                pts[m.group(1)] = (float(m.group(2)), float(m.group(3)))
            except ValueError:
                pass
    return pts


def _dot2(u, v):
    return u[0] * v[0] + u[1] * v[1]


def _dist2(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _check_2d_constraints(problem: str, commands: str) -> "str | None":
    """Return an error hint string if 2D geometric constraints are violated, else None."""
    pts = _parse_2d_points(commands)
    if not pts:
        return None

    issues: list[str] = []

    # Check right angle at a labeled vertex
    for m in _RIGHT_ANGLE_RE.finditer(problem):
        vertex = m.group(1).upper()
        if vertex not in pts:
            continue
        # Need two other named points to form the angle
        others = [k for k in pts if k != vertex and not k.startswith('_')]
        if len(others) < 2:
            continue
        # Use first two named points that are not the vertex
        p1, p2 = pts[others[0]], pts[others[1]]
        v = pts[vertex]
        u1 = (p1[0] - v[0], p1[1] - v[1])
        u2 = (p2[0] - v[0], p2[1] - v[1])
        dp = _dot2(u1, u2)
        if abs(dp) > 0.1 * (_dist2(v, p1) * _dist2(v, p2) + 1e-9):
            issues.append(
                f"Right angle at {vertex} violated: dot product of arms = {dp:.3f} (expected ≈0). "
                f"Adjust coordinates so vectors {vertex}{others[0]} and {vertex}{others[1]} are perpendicular."
            )

    # Check parallelogram: diagonals must bisect each other
    if _PARALLELOGRAM_RE.search(problem):
        named_pts = [k for k in pts if not k.startswith('_')]
        if len(named_pts) >= 4:
            a, b, c, d = named_pts[:4]
            pa, pb, pc, pd = pts[a], pts[b], pts[c], pts[d]
            mid_ac = ((pa[0] + pc[0]) / 2, (pa[1] + pc[1]) / 2)
            mid_bd = ((pb[0] + pd[0]) / 2, (pb[1] + pd[1]) / 2)
            gap = _dist2(mid_ac, mid_bd)
            if gap > 0.1:
                issues.append(
                    f"Parallelogram midpoint check failed: midpoint of {a}{c} = ({mid_ac[0]:.2f},{mid_ac[1]:.2f}), "
                    f"midpoint of {b}{d} = ({mid_bd[0]:.2f},{mid_bd[1]:.2f}), gap = {gap:.3f}. "
                    f"Diagonals must bisect each other for a parallelogram."
                )

    # Check square: all four sides equal length
    if _SQUARE_RE.search(problem):
        named_pts = [k for k in pts if not k.startswith('_')]
        if len(named_pts) >= 4:
            a, b, c, d = named_pts[:4]
            pa, pb, pc, pd = pts[a], pts[b], pts[c], pts[d]
            sides = [_dist2(pa, pb), _dist2(pb, pc), _dist2(pc, pd), _dist2(pd, pa)]
            if max(sides) - min(sides) > 0.1 * max(sides):
                issues.append(
                    f"Square side lengths unequal: {[f'{s:.2f}' for s in sides]}. "
                    f"All four sides must be equal for a square."
                )

    if not issues:
        return None
    return " | ".join(issues)


async def generate_figure(
    client,
    question: str,
    label: str,
    solver_output: SolverOutput,
    image_bytes: bytes | None = None,
    image_mime: str | None = None,
) -> FigureOutput | None:
    """Return FigureOutput or None (for NO_FIGURE). Never raises."""
    import base64 as _b64
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

            user_content: list = []
            if image_bytes and image_mime:
                data_uri = f"data:{image_mime};base64,{_b64.b64encode(image_bytes).decode()}"
                user_content.append({"type": "image_url", "image_url": {"url": data_uri}})
            user_content.append({"type": "text", "text": prompt})

            resp = await client.chat.completions.create(
                model=settings.default_model,
                messages=[{"role": "user", "content": user_content}],
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

            constraint_err = _check_3d_constraints(question, commands) or _check_2d_constraints(question, commands)
            if constraint_err and attempt < MAX_RETRIES:
                extra_hint = constraint_err
                logger.debug("Constraint violation on attempt %d: %s", attempt + 1, constraint_err)
                continue

            return FigureOutput(
                type="geogebra",
                data=commands,
                viewport=_infer_viewport(label, commands),
                caption=_infer_caption(label),
            )

        except Exception as exc:
            if attempt == MAX_RETRIES:
                logger.warning("Figure generation failed after %d attempts: %s", MAX_RETRIES + 1, exc)
                return FigureOutput(type="error", error="generation_failed")
            extra_hint = str(exc)
            logger.debug("Figure generation attempt %d failed: %s", attempt + 1, exc)
