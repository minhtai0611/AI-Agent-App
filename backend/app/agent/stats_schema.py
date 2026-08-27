"""Shared contract for AI-drafted discrete probability simulations.

The model only ever proposes which experiment to run — it never generates the trial
data itself. `run_simulation` (stats_simulator.py) executes the actual random trials
with numpy and computes the theoretical distribution independently with sympy/closed
forms.
"""
from typing import Literal

from pydantic import BaseModel, TypeAdapter

Experiment = Literal["dice", "coin", "sampling"]
Statistic = Literal["sum", "mean", "count"]


class SimulationSpec(BaseModel):
    experiment: Experiment
    n_dice: int | None = None
    trials: int = 1000
    statistic: Statistic = "sum"


_spec_adapter = TypeAdapter(SimulationSpec)


def validate_spec(data: dict) -> SimulationSpec:
    return _spec_adapter.validate_python(data)
