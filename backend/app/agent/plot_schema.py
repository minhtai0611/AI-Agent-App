"""Shared contract for AI-drafted 2D plot specs (Math Playground, natural-language entry
only). The model only ever proposes which curves/ops to plot — it never computes an
intersection or tangent line itself; verify_plot (plot_generator.py) does that with sympy.
"""
from typing import Literal

from pydantic import BaseModel, TypeAdapter

Op = Literal[
    "intersect", "tangent_at", "roots", "extrema", "derivative_at", "integral", "regression", "none",
]

CurveKind = Literal["function", "inequality", "parametric", "polar", "piecewise", "dataset"]


class Curve(BaseModel):
    expr: str = ""
    kind: CurveKind = "function"
    # parametric only: the y(t) counterpart to expr's x(t). Ignored for every other kind.
    expr_y: str | None = None
    # per-curve restriction, independent of the plot-wide `domain` viewport below.
    # function/piecewise: an x-range. parametric: a t-range. polar: a theta-range.
    domain: tuple[float, float] | None = None
    # dataset only: raw (x, y) points for a regression fit.
    points: list[tuple[float, float]] | None = None


class Parameter(BaseModel):
    """A named slider — a value the frontend lets the user drag, substituted into any
    curve expression that references `name`. Purely descriptive here; sympy never
    evaluates it, since it's a UI concern, not a math one."""
    name: str
    min: float
    max: float
    step: float = 0.1
    value: float


class PlotSpec(BaseModel):
    curves: list[Curve]
    domain: tuple[float, float, float, float] = (-10, 10, -10, 10)
    parameters: list[Parameter] = []
    ops: list[Op] = ["none"]
    tangent_at_x: float | None = None
    derivative_at_x: float | None = None
    integral_bounds: tuple[float, float] | None = None
    regression_kind: Literal["linear", "polynomial"] | None = None
    regression_degree: int | None = None


_spec_adapter = TypeAdapter(PlotSpec)


def validate_spec(data: dict) -> PlotSpec:
    return _spec_adapter.validate_python(data)
