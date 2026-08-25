"""Institutions Phase 2 — org content library.

A parallel schema, not a retrofit of the global exams/questions tables: org-private
content lives here and references a global question by id when reused. This is
deliberate — exam-app/src/api/index.js reads exam/question content static-JSON-first
and would silently ignore a server-side org_id filter bolted onto the global tables.
"""
import json
import uuid


async def create_draft(pool, org_id: str, member_id: str, body: dict) -> dict:
    item_id = f"cont_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO org_content_items (id, org_id, source_question_id, question, choices, correct, "
        "explanation, topic, difficulty, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
        item_id, org_id, body.get("sourceQuestionId"), body.get("question"),
        json.dumps(body.get("choices", []), ensure_ascii=False), body.get("correct"),
        body.get("explanation"), body.get("topic"), body.get("difficulty"), member_id,
    )
    return await get_item(pool, item_id)


async def get_item(pool, item_id: str) -> dict | None:
    row = await pool.fetchrow("SELECT * FROM org_content_items WHERE id=?", item_id)
    if not row:
        return None
    out = dict(row)
    if out.get("choices"):
        out["choices"] = json.loads(out["choices"])
    return out


async def list_items(pool, org_id: str, status: str | None = None) -> list[dict]:
    if status:
        rows = await pool.fetch("SELECT * FROM org_content_items WHERE org_id=? AND status=? ORDER BY created_at DESC", org_id, status)
    else:
        rows = await pool.fetch("SELECT * FROM org_content_items WHERE org_id=? ORDER BY created_at DESC", org_id)
    out = []
    for r in rows:
        d = dict(r)
        if d.get("choices"):
            d["choices"] = json.loads(d["choices"])
        out.append(d)
    return out


async def submit_for_review(pool, org_id: str, item_id: str) -> dict | None:
    await pool.execute(
        "UPDATE org_content_items SET status='pending_review' WHERE id=? AND org_id=?", item_id, org_id,
    )
    return await get_item(pool, item_id)


async def approve(pool, org_id: str, item_id: str, approver_member_id: str) -> dict | None:
    await pool.execute(
        "UPDATE org_content_items SET status='approved', approved_by=?, approved_at=datetime('now') "
        "WHERE id=? AND org_id=?",
        approver_member_id, item_id, org_id,
    )
    return await get_item(pool, item_id)


def _gen_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


async def create_org_exam(pool, org_id: str, member_id: str, title: str, items: list[dict]) -> dict:
    """items: [{questionId} | {orgContentItemId}], in order."""
    exam_id = _gen_id("oexam_")
    await pool.execute(
        "INSERT INTO org_exams (id, org_id, title, created_by) VALUES (?,?,?,?)", exam_id, org_id, title, member_id,
    )
    for i, item in enumerate(items):
        await pool.execute(
            "INSERT INTO org_exam_items (org_exam_id, question_id, org_content_item_id, position) VALUES (?,?,?,?)",
            exam_id, item.get("questionId"), item.get("orgContentItemId"), i,
        )
    return await get_org_exam(pool, org_id, exam_id)


async def get_org_exam(pool, org_id: str, exam_id: str) -> dict | None:
    exam = await pool.fetchrow("SELECT * FROM org_exams WHERE id=? AND org_id=?", exam_id, org_id)
    if not exam:
        return None
    item_rows = await pool.fetch(
        "SELECT question_id, org_content_item_id, position FROM org_exam_items WHERE org_exam_id=? ORDER BY position",
        exam_id,
    )
    resolved = []
    for row in item_rows:
        if row["question_id"]:
            q = await pool.fetchrow("SELECT * FROM questions WHERE id=?", row["question_id"])
            if q:
                d = {**dict(q), "choices": json.loads(q["choices"])}
                resolved.append(d)
        elif row["org_content_item_id"]:
            item = await get_item(pool, row["org_content_item_id"])
            if item:
                resolved.append(item)
    return {**dict(exam), "items": resolved}
