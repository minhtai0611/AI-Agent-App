"""Shared contract for AI-drafted 2D plot specs (Math Playground, natural-language entry
only). The model only ever proposes which curves/ops to plot — it never computes an
intersection or tangent line itself; verify_plot (plot_generator.py) does that with sympy.
"""
from typing import Literal

from pydantic import BaseModel, TypeAdapter

Op = Literal["intersect", "tangent_at", "none"]


class Curve(BaseModel):
    expr: str
    kind: Literal["function", "inequality"] = "function"


class PlotSpec(BaseModel):
    curves: list[Curve]
    domain: tuple[float, float, float, float] = (-10, 10, -10, 10)
    ops: list[Op] = ["none"]
    tangent_at_x: float | None = None


_spec_adapter = TypeAdapter(PlotSpec)


def validate_spec(data: dict) -> PlotSpec:
    return _spec_adapter.validate_python(data)
