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


async def generate_one(pool, client: AiRouterClient, topic: str, difficulty: str) -> dict:
    """Run the loop for a single item. Returns the resulting pending_questions row."""
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
            row = _draft_to_question_row(last_draft, result.verified_index)
            await pool.execute(
                "INSERT INTO questions (id, source, year, topic, difficulty, question, choices, correct, explanation, origin, qti_identifier) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                row["id"], row["source"], row["year"], row["topic"], row["difficulty"],
                row["question"], json.dumps(row["choices"], ensure_ascii=False), row["correct"],
                row["explanation"], row["origin"], row["qti_identifier"],
            )
            await pool.execute(
                "INSERT INTO pending_questions (id, draft_json, status, verification_log, attempt) VALUES (?,?,?,?,?)",
                pending_id, json.dumps(last_draft, ensure_ascii=False), "verified",
                json.dumps(last_log + [f"attempt {attempt}: verified as index {result.verified_index}"]), attempt,
            )
            return {"id": pending_id, "status": "verified", "question_id": row["id"]}

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
