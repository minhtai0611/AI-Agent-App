"""Bayesian Knowledge Tracing (BKT) per-concept mastery estimator.

BKT (Corbett & Anderson, 1994) models student knowledge as a two-state HMM:
  L_t = probability student knows the concept after t observations

Parameters (concept-level defaults, can be fit offline later):
  p_init  = P(known at start)      = 0.10
  p_learn = P(transition to known) = 0.25   — per correct answer in context
  p_slip  = P(error | known)       = 0.10
  p_guess = P(correct | not known) = 0.25

Usage:
  score = bkt_mastery(answers)   # list of True/False, oldest first
  # returns float in [0, 1]
"""

_P_INIT  = 0.10
_P_LEARN = 0.25
_P_SLIP  = 0.10
_P_GUESS = 0.25


def bkt_update(L: float, correct: bool) -> float:
    """Single BKT update step. Returns posterior P(known | observation)."""
    if correct:
        # P(known | correct) via Bayes
        p_corr_known = 1.0 - _P_SLIP
        p_corr_unkn  = _P_GUESS
    else:
        p_corr_known = _P_SLIP
        p_corr_unkn  = 1.0 - _P_GUESS

    # Posterior P(known | obs)
    num = p_corr_known * L
    den = num + p_corr_unkn * (1.0 - L)
    L_posterior = num / den if den > 1e-9 else L

    # Transition: student may have learned during this step
    L_new = L_posterior + (1.0 - L_posterior) * _P_LEARN
    return max(0.0, min(1.0, L_new))


def bkt_mastery(answers: list[bool]) -> float:
    """Run BKT over a sequence of answers (oldest first). Returns P(known)."""
    L = _P_INIT
    for correct in answers:
        L = bkt_update(L, correct)
    return round(L, 4)


def bkt_mastery_stage(score: float) -> int:
    """Map BKT mastery score to a 0-5 stage (matches concept_mastery.stage)."""
    if score < 0.15: return 0    # novice
    if score < 0.35: return 1    # beginning
    if score < 0.55: return 2    # developing
    if score < 0.70: return 3    # proficient
    if score < 0.85: return 4    # advanced
    return 5                     # mastered
