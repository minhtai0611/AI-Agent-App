"""Shared contract for AI-drafted calculus operation requests.

The model only ever proposes which operation to run and on which expression — it never
differentiates, integrates, or solves an ODE itself. Mirrors linalg_schema.py's shape.
"""
from typing import Literal

from pydantic import BaseModel, TypeAdapter

Operation = Literal["derivative", "integral_indefinite", "integral_definite", "limit", "series", "dsolve"]


class CalculusSpec(BaseModel):
    operation: Operation
    expr: str
    variable: str = "x"
    order: int = 1
    point: float | None = None
    bounds: tuple[float, float] | None = None


_spec_adapter = TypeAdapter(CalculusSpec)


def validate_spec(data: dict) -> CalculusSpec:
    """Raises pydantic.ValidationError if `data` doesn't match the CalculusSpec shape."""
    return _spec_adapter.validate_python(data)
