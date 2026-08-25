"""The generate -> verify -> gate loop.

"Fully autonomous" means the gate is a rule (independent symbolic verification passed),
not a person clicking approve. A verified draft promotes straight into `questions` with
origin='agent'; a draft that fails after MAX_ATTEMPTS lands in `pending_questions` with
status='rejected' for a human to inspect later — the safety valve, not the default path.
"""
import hashlib
import json
import logging
import uuid

from app.agent import generator, verifier
from app.agent.router_client import AiRouterClient

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _content_hash(draft: dict) -> str:
    canonical = json.dumps(
        {k: draft[k] for k in ("topic", "difficulty", "given_equations", "target_expression")},
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _draft_to_question_row(draft: dict, verified_index: int) -> dict:
    return {
        "id": f"q_agent_{uuid.uuid4().hex[:12]}",
        "source": "agent-generated",
        "year": None,
        "topic": draft["topic"],
        "difficulty": draft["difficulty"],
        "question": draft["question_tex"],
        "choices": [f"${c}$" for c in draft["choice_expressions"]],
        "correct": verified_index,
        "explanation": draft["explanation_tex"],
        "origin": "agent",
        "qti_identifier": str(uuid.uuid4()),
    }


async def _promote_verified_draft(pool, draft: dict, verified_index: int) -> str:
    """Insert a verified draft into the live `questions` bank. Shared by generate_one's
    auto-promote path and the org-scoped human-approve path (orchestrator.approve_pending) —
    both must build the row identically.
    """
    row = _draft_to_question_row(draft, verified_index)
    await pool.execute(
        "INSERT INTO questions (id, source, year, topic, difficulty, question, choices, correct, explanation, origin, qti_identifier) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        row["id"], row["source"], row["year"], row["topic"], row["difficulty"],
        row["question"], json.dumps(row["choices"], ensure_ascii=False), row["correct"],
        row["explanation"], row["origin"], row["qti_identifier"],
    )
    return row["id"]


async def generate_one(pool, client: AiRouterClient, topic: str, difficulty: str) -> dict:
    """Run the loop for a single item. Returns the resulting pending_questions row.

    Auto-promotes on verify-success — unchanged behavior for the platform-wide pipeline.
    Org-scoped generation goes through generate_one_for_org instead, which gates
    promotion behind an explicit admin approval (Institutions Phase 3).
    """
    pending_id = f"pend_{uuid.uuid4().hex[:12]}"
    feedback = None
    last_draft = None
    last_log = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            last_draft = await generator.draft(client, topic, difficulty, feedback=feedback)
        except generator.DraftShapeError as exc:
            last_log.append(f"attempt {attempt}: draft rejected — malformed shape: {exc}")
            feedback = str(exc)
            continue

        result = verifier.verify(last_draft)
        content_hash = _content_hash(last_draft)
        await pool.execute(
            "INSERT OR REPLACE INTO content_ledger (content_hash, topic, difficulty, status) VALUES (?,?,?,?)",
            content_hash, topic, difficulty, "verified" if result.ok else "rejected",
        )

        if result.ok:
            question_id = await _promote_verified_draft(pool, last_draft, result.verified_index)
            await pool.execute(
                "INSERT INTO pending_questions (id, draft_json, status, verification_log, attempt) VALUES (?,?,?,?,?)",
                pending_id, json.dumps(last_draft, ensure_ascii=False), "verified",
                json.dumps(last_log + [f"attempt {attempt}: verified as index {result.verified_index}"]), attempt,
            )
            return {"id": pending_id, "status": "verified", "question_id": question_id}

        last_log.append(f"attempt {attempt}: rejected — {result.reason}")
        feedback = result.reason

    await pool.execute(
        "INSERT INTO pending_questions (id, draft_json, status, verification_log, attempt) VALUES (?,?,?,?,?)",
        pending_id, json.dumps(last_draft, ensure_ascii=False) if last_draft else "{}",
        "rejected", json.dumps(last_log), MAX_ATTEMPTS,
    )
    return {"id": pending_id, "status": "rejected", "log": last_log}


async def generate_batch(pool, client: AiRouterClient, topic: str, difficulty: str, count: int) -> list[dict]:
    return [await generate_one(pool, client, topic, difficulty) for _ in range(count)]


async def generate_one_for_org(pool, client: AiRouterClient, topic: str, difficulty: str, org_id: str, content_library_id: str | None = None) -> dict:
    """Org-scoped generation — a verified draft lands in pending_questions with
    status='verified_pending_review' instead of auto-promoting; only an explicit
    approve_pending() call promotes it into the live bank.
    """
    pending_id = f"pend_{uuid.uuid4().hex[:12]}"
    feedback = None
    last_draft = None
    last_log = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            last_draft = await generator.draft(client, topic, difficulty, feedback=feedback)
        except generator.DraftShapeError as exc:
            last_log.append(f"attempt {attempt}: draft rejected — malformed shape: {exc}")
            feedback = str(exc)
            continue

        result = verifier.verify(last_draft)
        content_hash = _content_hash(last_draft)
        await pool.execute(
            "INSERT OR REPLACE INTO content_ledger (content_hash, topic, difficulty, status) VALUES (?,?,?,?)",
            content_hash, topic, difficulty, "verified" if result.ok else "rejected",
        )

        if result.ok:
            draft_with_index = {**last_draft, "_verified_index": result.verified_index}
            await pool.execute(
                "INSERT INTO pending_questions (id, draft_json, status, verification_log, attempt, org_id, content_library_id) "
                "VALUES (?,?,?,?,?,?,?)",
                pending_id, json.dumps(draft_with_index, ensure_ascii=False), "verified_pending_review",
                json.dumps(last_log + [f"attempt {attempt}: verified as index {result.verified_index}, awaiting org approval"]),
                attempt, org_id, content_library_id,
            )
            return {"id": pending_id, "status": "verified_pending_review"}

        last_log.append(f"attempt {attempt}: rejected — {result.reason}")
        feedback = result.reason

    await pool.execute(
        "INSERT INTO pending_questions (id, draft_json, status, verification_log, attempt, org_id, content_library_id) "
        "VALUES (?,?,?,?,?,?,?)",
        pending_id, json.dumps(last_draft, ensure_ascii=False) if last_draft else "{}",
        "rejected", json.dumps(last_log), MAX_ATTEMPTS, org_id, content_library_id,
    )
    return {"id": pending_id, "status": "rejected", "log": last_log}


async def generate_batch_for_org(pool, client: AiRouterClient, topic: str, difficulty: str, count: int, org_id: str, content_library_id: str | None = None) -> list[dict]:
    return [await generate_one_for_org(pool, client, topic, difficulty, org_id, content_library_id) for _ in range(count)]


async def approve_pending(pool, org_id: str, pending_id: str) -> dict:
    row = await pool.fetchrow(
        "SELECT * FROM pending_questions WHERE id=? AND org_id=? AND status='verified_pending_review'", pending_id, org_id,
    )
    if not row:
        return None
    draft = json.loads(row["draft_json"])
    verified_index = draft.pop("_verified_index")
    question_id = await _promote_verified_draft(pool, draft, verified_index)
    await pool.execute("UPDATE pending_questions SET status='approved' WHERE id=?", pending_id)
    return {"id": pending_id, "status": "approved", "question_id": question_id}
