"""Institutions Phase 3 — recompute per-question response stats and flag anomalies.

Reads Phase 2's org_exam_attempts.item_responses. Complementary to, not a
replacement for, app.agent.auditor's AI answer-key mismatch check — this is about
response-pattern statistics, not re-deriving the correct answer.
"""
import json
import uuid

from app.psychometrics.stats import difficulty_index, discrimination_index

LOW_DISCRIMINATION_THRESHOLD = 0.1


async def recompute_stats_for_question(pool, question_id: str, org_id: str | None = None) -> dict:
    if org_id:
        rows = await pool.fetch("SELECT item_responses, score FROM org_exam_attempts WHERE org_id=?", org_id)
    else:
        rows = await pool.fetch("SELECT item_responses, score FROM org_exam_attempts")

    scored_responses = []  # (overall_attempt_score, correct: bool)
    for row in rows:
        try:
            responses = json.loads(row["item_responses"] or "[]")
        except (TypeError, ValueError):
            continue
        for resp in responses:
            if resp.get("question_id") == question_id:
                scored_responses.append((row["score"] or 0, bool(resp.get("correct"))))

    total = len(scored_responses)
    correct = sum(1 for _, ok in scored_responses if ok)
    diff_idx = difficulty_index(correct, total)

    await pool.execute(
        "INSERT OR REPLACE INTO question_response_stats "
        "(question_id, org_id, choice_index, pick_count, correct_count, total_attempts) VALUES (?,?,?,?,?,?)",
        question_id, org_id, 0, total, correct, total,
    )

    if total >= 10:
        sorted_responses = sorted(scored_responses, key=lambda r: r[0])
        cut = max(1, total // 4)
        low_group, high_group = sorted_responses[:cut], sorted_responses[-cut:]
        high_rate = sum(1 for _, ok in high_group if ok) / len(high_group)
        low_rate = sum(1 for _, ok in low_group if ok) / len(low_group)
        disc = discrimination_index(high_rate, low_rate)
        if disc < LOW_DISCRIMINATION_THRESHOLD:
            flag_id = f"flag_{uuid.uuid4().hex[:12]}"
            await pool.execute(
                "INSERT INTO psychometric_flags (id, question_id, org_id, flag_type, metric_value, detail) VALUES (?,?,?,?,?,?)",
                flag_id, question_id, org_id, "low_discrimination", disc,
                f"discrimination index {disc:.2f} below threshold {LOW_DISCRIMINATION_THRESHOLD}",
            )

    return {"question_id": question_id, "total_attempts": total, "difficulty_index": diff_idx}
