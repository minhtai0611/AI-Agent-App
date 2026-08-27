"""Generate -> simulate -> verify loop for the discrete probability simulator.

Same split as the rest of the Pure Mathematics Toolset: the model only ever proposes
which experiment/parameters to run — `run_simulation` executes the actual random trials
with numpy (never the LLM) and computes the theoretical distribution independently via
exact enumeration/binomial formulas. `verify_simulation` is a *tolerance-based* sanity
check, not an exact symbolic proof like verify_visualization/verify_steps/verify_linalg —
documented here and in the plan as a deliberately weaker guarantee, since the output is
inherently random and an exact match would itself be suspicious.

Only "dice" and "coin" experiments are implemented; "sampling" is intentionally not
built yet (abstains) rather than shipping a vaguely-specified feature.
"""
from itertools import product
from pathlib import Path

import numpy as np
import sympy

from app.agent.router_client import AiRouterClient
from app.agent.stats_schema import SimulationSpec, validate_spec

_PROMPT_PATH = Path(__file__).parent / "prompts" / "draft_simulation.md"


class SimulationShapeError(ValueError):
    """Raised when the model's JSON is neither a valid abstention nor a valid spec."""


async def draft_simulation(client: AiRouterClient, prompt_text: str) -> dict:
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    result = await client.complete_json(system_prompt, prompt_text)

    if result.get("available") is False:
        return {"available": False, "reason": result.get("reason", "model self-abstained")}

    spec_fields = {k: v for k, v in result.items() if k not in ("available", "reason")}
    try:
        spec = validate_spec(spec_fields)
    except Exception as exc:
        raise SimulationShapeError(str(exc)) from exc

    return {"available": True, "spec": spec}


def _dice_sum_pmf(n_dice: int) -> dict[int, sympy.Rational]:
    """Exact theoretical PMF via enumeration — fine for the small n_dice this feature
    targets (THPT problems use 1-3 dice, never dozens)."""
    total = 6**n_dice
    counts: dict[int, int] = {}
    for combo in product(range(1, 7), repeat=n_dice):
        s = sum(combo)
        counts[s] = counts.get(s, 0) + 1
    return {s: sympy.Rational(c, total) for s, c in counts.items()}


def _pmf_moments(pmf: dict) -> tuple[sympy.Rational, sympy.Rational]:
    mean = sum(sympy.Integer(k) * p for k, p in pmf.items())
    var = sum(p * (sympy.Integer(k) - mean) ** 2 for k, p in pmf.items())
    return mean, var


def run_simulation(spec: SimulationSpec) -> dict:
    """Deterministic numpy RNG for the trials; exact sympy for the theoretical PMF.
    Raises NotImplementedError for any experiment other than dice/coin.
    """
    rng = np.random.default_rng()

    if spec.experiment == "dice":
        n = spec.n_dice or 2
        rolls = rng.integers(1, 7, size=(spec.trials, n))
        samples = rolls.mean(axis=1) if spec.statistic == "mean" else rolls.sum(axis=1)
        pmf = _dice_sum_pmf(n)
        mean, var = _pmf_moments(pmf)
        if spec.statistic == "mean":
            mean, var = mean / n, var / (n * n)
        return {"spec": spec, "samples": samples, "pmf": pmf, "theoretical_mean": mean, "theoretical_var": var}

    if spec.experiment == "coin":
        n = spec.n_dice or 10
        flips = rng.integers(0, 2, size=(spec.trials, n))
        samples = flips.sum(axis=1)  # heads count per trial
        mean = sympy.Rational(n, 2)
        var = sympy.Rational(n, 4)
        pmf = {k: sympy.binomial(n, k) * sympy.Rational(1, 2) ** n for k in range(n + 1)}
        return {"spec": spec, "samples": samples, "pmf": pmf, "theoretical_mean": mean, "theoretical_var": var}

    raise NotImplementedError(f"experiment '{spec.experiment}' is not yet supported")


def verify_simulation(result: dict) -> dict:
    """Tolerance check: the empirical mean must fall within a generous (4-sigma) band of
    the theoretical mean, scaled by trial count. A genuine simulation run almost never
    fails this; a fabricated/impossible result (e.g. a hand-crafted histogram) usually does.
    Returns {"ok": bool, "reason": str} — deliberately not verifier.VerificationResult,
    to keep this weaker-guarantee shape visually distinct from the exact-check features.
    """
    samples = result["samples"]
    trials = len(samples)
    theoretical_mean = float(result["theoretical_mean"])
    theoretical_var = float(result["theoretical_var"])
    empirical_mean = float(np.mean(samples))

    standard_error = (theoretical_var / trials) ** 0.5 if trials > 0 else 0
    tolerance = max(4 * standard_error, 1e-9)
    if abs(empirical_mean - theoretical_mean) > tolerance:
        return {
            "ok": False,
            "reason": (
                f"empirical mean {empirical_mean:.3f} is outside the expected range "
                f"{theoretical_mean:.3f} +/- {tolerance:.3f} for {trials} trials"
            ),
        }
    return {"ok": True, "reason": "within statistical tolerance"}


def _serialize_pmf(pmf: dict) -> dict:
    return {str(k): float(v) for k, v in pmf.items()}


async def generate_simulation(client: AiRouterClient, prompt_text: str) -> dict:
    """draft -> run -> verify -> gate. Returns
    {"available": bool, "histogram": list[int] | None, "pmf": dict | None, "reason": str | None}.
    """
    try:
        draft = await draft_simulation(client, prompt_text)
    except SimulationShapeError as exc:
        return {"available": False, "histogram": None, "pmf": None, "reason": f"malformed draft — {exc}"}

    if not draft.get("available"):
        return {"available": False, "histogram": None, "pmf": None, "reason": draft.get("reason")}

    try:
        result = run_simulation(draft["spec"])
    except NotImplementedError as exc:
        return {"available": False, "histogram": None, "pmf": None, "reason": str(exc)}

    verification = verify_simulation(result)
    if not verification["ok"]:
        return {"available": False, "histogram": None, "pmf": None, "reason": verification["reason"]}

    return {
        "available": True,
        "histogram": [int(v) for v in result["samples"]],
        "pmf": _serialize_pmf(result["pmf"]),
        "reason": None,
    }
