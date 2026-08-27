"""Shared contract for AI-generated 3D visualization specs.

The model never returns free-form rendering code — only one of these constrained,
typed shapes (discriminated by `template`). The frontend owns a fixed React-three-fiber
template per `template` value; adding a template means updating this file AND the
frontend's `scenes/concept/registry.js` together — they must stay in lockstep.
"""
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter

Highlight = Literal["none", "cross_section", "apex_edges", "height"]


class PyramidSpec(BaseModel):
    template: Literal["pyramid"]
    base: Literal["square", "triangle", "rectangle"]
    base_side: float | None = None
    base_dims: tuple[float, float] | None = None
    apex_height: float
    highlight: Highlight = "none"


class PrismSpec(BaseModel):
    template: Literal["prism"]
    base: Literal["triangle", "rectangle", "hexagon"]
    base_side: float
    height: float
    highlight: Highlight = "none"


class SphereConeSpec(BaseModel):
    template: Literal["sphere_cone"]
    shape: Literal["sphere", "cone", "cylinder"]
    radius: float
    height: float | None = None
    highlight: Literal["none", "cross_section", "inscribed_sphere"] = "none"


class ConicSectionSpec(BaseModel):
    template: Literal["conic_section"]
    kind: Literal["ellipse", "parabola", "hyperbola"]
    params: dict[str, float]


class VectorSpec(BaseModel):
    template: Literal["vector_add"]
    dim: Literal[2, 3]
    vectors: list[list[float]]
    show_sum: bool = True


class SurfaceSpec(BaseModel):
    template: Literal["function_surface"]
    expr: str
    domain: tuple[float, float, float, float]


class RevolutionSpec(BaseModel):
    template: Literal["solid_of_revolution"]
    expr: str
    axis: Literal["x", "y"]
    bounds: tuple[float, float]


VisualizationSpec = Annotated[
    Union[PyramidSpec, PrismSpec, SphereConeSpec, ConicSectionSpec, VectorSpec, SurfaceSpec, RevolutionSpec],
    Field(discriminator="template"),
]

_spec_adapter = TypeAdapter(VisualizationSpec)


def validate_spec(data: dict) -> BaseModel:
    """Raises pydantic.ValidationError if `data` doesn't match any known template shape."""
    return _spec_adapter.validate_python(data)


class VisualizationResult(BaseModel):
    available: bool
    spec: dict | None = None
    annotation: str | None = None
    reason: str | None = None
