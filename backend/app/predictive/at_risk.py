"""Institutions Phase 3 — predictive cohort signals. Rule-based/statistical, not
LLM-based, deliberately — an auditable early-warning signal, not a black box.
Consumes Phase 2's org_exam_attempts; no independent data collection of its own.
"""
import uuid

DECLINING_THRESHOLD = 0.15  # a >=15pt drop between a member's first and last attempt


async def compute_at_risk_signals(pool, org_id: str, cohort_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT org_member_id, score, submitted_at FROM org_exam_attempts "
        "WHERE org_id=? AND cohort_id=? ORDER BY org_member_id, submitted_at",
        org_id, cohort_id,
    )
    by_member: dict[str, list[float]] = {}
    for row in rows:
        by_member.setdefault(row["org_member_id"], []).append(row["score"] or 0)

    signals = []
    for member_id, scores in by_member.items():
        if len(scores) < 2:
            continue
        drop = scores[0] - scores[-1]
        if drop >= DECLINING_THRESHOLD:
            signals.append({
                "id": f"risk_{uuid.uuid4().hex[:12]}",
                "cohort_id": cohort_id, "org_id": org_id, "org_member_id": member_id,
                "signal_type": "declining_score", "severity": "high" if drop >= 0.3 else "medium",
                "detail": {"first_score": scores[0], "last_score": scores[-1], "drop": drop},
            })
    return signals


async def persist_signals(pool, signals: list[dict]) -> None:
    import json

    for s in signals:
        await pool.execute(
            "INSERT INTO cohort_risk_signals (id, cohort_id, org_id, org_member_id, signal_type, severity, detail_json) "
            "VALUES (?,?,?,?,?,?,?)",
            s["id"], s["cohort_id"], s["org_id"], s["org_member_id"], s["signal_type"], s["severity"],
            json.dumps(s["detail"], ensure_ascii=False),
        )
