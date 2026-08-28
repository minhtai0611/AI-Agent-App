"""Shared contract for AI-drafted nonlinear equation-system requests.

The model only ever proposes the equations and the unknowns to solve for — it never
solves the system itself. Mirrors linalg_schema.py's shape.
"""
from pydantic import BaseModel, TypeAdapter


class EquationSystemSpec(BaseModel):
    equations: list[str]
    variables: list[str]


_spec_adapter = TypeAdapter(EquationSystemSpec)


def validate_spec(data: dict) -> EquationSystemSpec:
    """Raises pydantic.ValidationError if `data` doesn't match the EquationSystemSpec shape."""
    return _spec_adapter.validate_python(data)
