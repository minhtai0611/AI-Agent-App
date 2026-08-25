"""Institutions Phase 3 — proctoring tier policy. Pure logic, no vendor dependency,
independently unit-testable.
"""

TIERS = ["none", "ai_review", "identity_plus_ai", "human_escalation"]

_STAKES_CEILING = {
    "low": "ai_review",
    "medium": "identity_plus_ai",
    "certification": "human_escalation",
}


def resolve_tier(stakes_tier: str, org_opt_in_ceiling: str) -> str:
    """The effective tier is the lower of what the exam's stakes call for and what
    the org has opted into — an org can cap proctoring below an exam's natural
    ceiling, but never exceed it just by opting into more.
    """
    exam_ceiling = _STAKES_CEILING.get(stakes_tier, "none")
    exam_idx = TIERS.index(exam_ceiling)
    org_idx = TIERS.index(org_opt_in_ceiling) if org_opt_in_ceiling in TIERS else 0
    return TIERS[min(exam_idx, org_idx)]


def requires_vendor(tier: str) -> bool:
    return tier in ("identity_plus_ai", "human_escalation")
