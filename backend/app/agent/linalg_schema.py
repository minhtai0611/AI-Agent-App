"""Shared contract for AI-drafted linear-algebra operation requests.

The model only ever proposes which operation to run and on which matrices — it never
computes a determinant, inverse, or solution itself. `eigen` is reachable only via the
frontend's advanced toggle (off by default); the default NL-prompt vocabulary given to
draft_linalg_spec never mentions it, since THPT curriculum rarely needs eigendecomposition.
"""
from typing import Literal

from pydantic import BaseModel, TypeAdapter

Operation = Literal["add", "multiply", "determinant", "inverse", "rank", "rref", "solve_system", "eigen"]


class LinAlgSpec(BaseModel):
    operation: Operation
    matrices: list[list[list[float]]]


_spec_adapter = TypeAdapter(LinAlgSpec)


def validate_spec(data: dict) -> LinAlgSpec:
    """Raises pydantic.ValidationError if `data` doesn't match the LinAlgSpec shape."""
    return _spec_adapter.validate_python(data)
