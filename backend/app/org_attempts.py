"""Institutions Phase 2 — org exam attempts + cohort/item analytics.

Nothing aggregates exam results server-side today (HistoryContext.jsx is purely
localStorage). This table is the new server-side source cohort/program analytics
reads from — an org-session submission writes here *in addition to* (not instead of)
the existing local history write.
"""
import json
import uuid


async def record_attempt(pool, org_id: str, member_id: str, body: dict) -> dict:
    attempt_id = f"att_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO org_exam_attempts (id, org_id, cohort_id, org_member_id, exam_ref_type, exam_id, "
        "score, item_responses, started_at, source) VALUES (?,?,?,?,?,?,?,?,?,?)",
        attempt_id, org_id, body.get("cohortId"), member_id, body.get("examRefType", "global"),
        body["examId"], body.get("score"),
        json.dumps(body.get("itemResponses", []), ensure_ascii=False),
        body.get("startedAt"), body.get("source", "web"),
    )
    return dict(await pool.fetchrow("SELECT * FROM org_exam_attempts WHERE id=?", attempt_id))


async def cohort_analytics(pool, org_id: str, cohort_id: str) -> dict:
    row = await pool.fetchrow(
        "SELECT COUNT(*) AS attempts, AVG(score) AS avg_score, "
        "SUM(CASE WHEN score >= 0.5 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0) AS pass_rate "
        "FROM org_exam_attempts WHERE org_id=? AND cohort_id=?",
        org_id, cohort_id,
    )
    return dict(row) if row else {"attempts": 0, "avg_score": None, "pass_rate": None}


async def item_analytics(pool, org_id: str) -> list[dict]:
    """Per-question aggregate difficulty across this org's attempts (item_responses JSON)."""
    rows = await pool.fetch("SELECT item_responses FROM org_exam_attempts WHERE org_id=?", org_id)
    stats: dict[str, dict] = {}
    for row in rows:
        try:
            responses = json.loads(row["item_responses"] or "[]")
        except (TypeError, ValueError):
            continue
        for resp in responses:
            qid = resp.get("question_id")
            if not qid:
                continue
            s = stats.setdefault(qid, {"question_id": qid, "attempts": 0, "correct": 0})
            s["attempts"] += 1
            if resp.get("correct"):
                s["correct"] += 1
    for s in stats.values():
        s["difficulty_index"] = s["correct"] / s["attempts"] if s["attempts"] else None
    return list(stats.values())
