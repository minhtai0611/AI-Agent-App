"""Institutions Phase 3 — psychometric math. Pure functions, no DB/network — mirrors
verifier.py's no-I/O design so this is trivially unit-testable.
"""


def difficulty_index(correct_count: int, total_attempts: int) -> float | None:
    """Classic p-value: fraction of attempts answered correctly. 0 = hardest, 1 = easiest."""
    if total_attempts <= 0:
        return None
    return correct_count / total_attempts


def discrimination_index(high_group_correct_rate: float, low_group_correct_rate: float) -> float:
    """Classic upper-27%/lower-27% split discrimination index. A well-functioning item
    has high-scorers answering correctly more often than low-scorers (positive value);
    near-zero or negative values mean the item doesn't distinguish ability well.
    """
    return high_group_correct_rate - low_group_correct_rate


def flag_drift(historical_difficulty: float, recent_difficulty: float, threshold: float = 0.2) -> bool:
    """True if a question's difficulty has moved more than `threshold` between an
    earlier baseline and a recent window — a sign of leak, staleness, or drift.
    """
    if historical_difficulty is None or recent_difficulty is None:
        return False
    return abs(recent_difficulty - historical_difficulty) >= threshold
