import asyncio
import json
import logging
from datetime import datetime
from app.math_wiki.schemas import WikiUnit, Problem

logger = logging.getLogger(__name__)


def _row_to_wiki_unit(row) -> WikiUnit:
    return WikiUnit(
        id=row["id"],
        type=row["type"],
        topic=row["topic"],
        subtopic=row["subtopic"],
        content=row["content"],
        problem_ids=json.loads(row["problem_ids"]),
    )


# ── Core CRUD ─────────────────────────────────────────────────────────────────

async def _compute_embedding(content: str) -> list[float]:
    from app.math_wiki.storage.vectors import embed_texts
    loop = asyncio.get_event_loop()
    vecs = await loop.run_in_executor(None, embed_texts, [content], "passage")
    return vecs[0]


async def upsert_wiki_unit(
    pool,
    unit: WikiUnit,
    source: str = "manual",
    source_url: str | None = None,
    editor: str | None = None,
    reason: str | None = None,
    embedding: list[float] | None = None,
) -> None:
    now = datetime.now().isoformat()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT version, content, created_at FROM wiki_units WHERE id = $1", unit.id
        )
        if row:
            # Recompute embedding only if content changed
            if embedding is None and row["content"] != unit.content:
                embedding = await _compute_embedding(unit.content)
            await conn.execute(
                """INSERT INTO wiki_unit_history (unit_id, version, content, edited_by, reason)
                   VALUES ($1, $2, $3, $4, $5)""",
                unit.id, row["version"], row["content"], editor, reason,
            )
            if embedding is not None:
                await conn.execute(
                    """UPDATE wiki_units
                       SET type=$1, topic=$2, subtopic=$3, content=$4, problem_ids=$5,
                           source=$6, source_url=$7, version=$8, last_edited_by=$9,
                           updated_at=$10, embedding=$11
                       WHERE id=$12""",
                    unit.type, unit.topic, unit.subtopic, unit.content,
                    json.dumps(unit.problem_ids), source, source_url,
                    row["version"] + 1, editor, now, embedding, unit.id,
                )
            else:
                await conn.execute(
                    """UPDATE wiki_units
                       SET type=$1, topic=$2, subtopic=$3, content=$4, problem_ids=$5,
                           source=$6, source_url=$7, version=$8, last_edited_by=$9, updated_at=$10
                       WHERE id=$11""",
                    unit.type, unit.topic, unit.subtopic, unit.content,
                    json.dumps(unit.problem_ids), source, source_url,
                    row["version"] + 1, editor, now, unit.id,
                )
        else:
            # Always compute embedding on insert
            if embedding is None:
                embedding = await _compute_embedding(unit.content)
            await conn.execute(
                """INSERT INTO wiki_units
                   (id, type, topic, subtopic, content, problem_ids, source, source_url,
                    deleted, version, last_edited_by, created_at, updated_at, embedding)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,1,$9,$10,$11,$12)""",
                unit.id, unit.type, unit.topic, unit.subtopic,
                unit.content, json.dumps(unit.problem_ids), source, source_url,
                editor, now, now, embedding,
            )


async def get_all_wiki_units(pool) -> list[WikiUnit]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM wiki_units WHERE deleted = false")
    return [_row_to_wiki_unit(r) for r in rows]


async def get_wiki_units_by_ids(pool, ids: list[str]) -> list[WikiUnit]:
    if not ids:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM wiki_units WHERE id = ANY($1) AND deleted = false", ids
        )
    by_id = {r["id"]: _row_to_wiki_unit(r) for r in rows}
    return [by_id[i] for i in ids if i in by_id]


async def count_wiki_units(pool) -> int:
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM wiki_units WHERE deleted = false")


async def count_wiki_units_by_topic(pool) -> dict[str, int]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT topic, COUNT(*) AS cnt FROM wiki_units WHERE deleted = false GROUP BY topic"
        )
    return {r["topic"]: r["cnt"] for r in rows}


async def count_problems(pool) -> int:
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM problems")


async def upsert_problem(
    pool,
    problem: Problem,
    figure_svg: str | None = None,
    problem_hash: str | None = None,
    figure_type: str = "svg",
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO problems
               (problem_id, problem_text, choices, correct_answer, topic, subtopic,
                difficulty, problem_type, figure_svg, problem_hash, figure_type)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (problem_id) DO UPDATE SET
                   problem_text=EXCLUDED.problem_text,
                   choices=EXCLUDED.choices,
                   correct_answer=EXCLUDED.correct_answer,
                   figure_svg=EXCLUDED.figure_svg,
                   problem_hash=EXCLUDED.problem_hash,
                   figure_type=EXCLUDED.figure_type""",
            problem.problem_id,
            problem.problem_text,
            json.dumps(problem.choices) if problem.choices is not None else None,
            problem.correct_answer,
            problem.topic,
            problem.subtopic,
            problem.difficulty,
            problem.problem_type,
            figure_svg,
            problem_hash,
            figure_type,
        )


async def get_cached_figure(pool, problem_hash: str) -> tuple[str, str] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT figure_svg, figure_type FROM problems "
            "WHERE problem_hash = $1 AND figure_svg IS NOT NULL LIMIT 1",
            problem_hash,
        )
    if row is None:
        return None
    return row["figure_svg"], row["figure_type"] or "svg"


async def get_all_content_hashes(pool) -> set[str]:
    import hashlib
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT content FROM wiki_units WHERE deleted = false")
    return {hashlib.md5(r["content"].encode()).hexdigest() for r in rows}


# ── Admin read/write ──────────────────────────────────────────────────────────

async def list_wiki_units_admin(
    pool,
    topic: str | None = None,
    source: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    conditions = []
    params: list = []
    idx = 1
    if not include_deleted:
        conditions.append(f"deleted = false")
    if topic:
        conditions.append(f"topic = ${idx}")
        params.append(topic)
        idx += 1
    if source:
        conditions.append(f"source = ${idx}")
        params.append(source)
        idx += 1
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params += [limit, offset]
    query = f"SELECT * FROM wiki_units {where} ORDER BY updated_at DESC LIMIT ${idx} OFFSET ${idx+1}"
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


async def get_wiki_unit_with_history(pool, unit_id: str) -> dict | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM wiki_units WHERE id = $1", unit_id)
        if not row:
            return None
        history = await conn.fetch(
            "SELECT * FROM wiki_unit_history WHERE unit_id = $1 ORDER BY version DESC",
            unit_id,
        )
    return {"unit": dict(row), "history": [dict(h) for h in history]}


async def soft_delete_wiki_unit(pool, unit_id: str, editor: str = "admin") -> bool:
    now = datetime.now().isoformat()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT version, content FROM wiki_units WHERE id = $1 AND deleted = false", unit_id
        )
        if not row:
            return False
        await conn.execute(
            """INSERT INTO wiki_unit_history (unit_id, version, content, edited_by, reason)
               VALUES ($1,$2,$3,$4,$5)""",
            unit_id, row["version"], row["content"], editor, "soft_delete",
        )
        await conn.execute(
            "UPDATE wiki_units SET deleted = true, last_edited_by = $1, updated_at = $2 WHERE id = $3",
            editor, now, unit_id,
        )
    return True


async def restore_wiki_unit(pool, unit_id: str, version: int | None = None, editor: str = "admin") -> bool:
    now = datetime.now().isoformat()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM wiki_units WHERE id = $1", unit_id)
        if not row:
            return False
        if version is not None:
            hist = await conn.fetchrow(
                "SELECT content FROM wiki_unit_history WHERE unit_id = $1 AND version = $2",
                unit_id, version,
            )
            if not hist:
                return False
            await conn.execute(
                "UPDATE wiki_units SET content=$1, deleted=false, last_edited_by=$2, updated_at=$3 WHERE id=$4",
                hist["content"], editor, now, unit_id,
            )
        else:
            await conn.execute(
                "UPDATE wiki_units SET deleted=false, last_edited_by=$1, updated_at=$2 WHERE id=$3",
                editor, now, unit_id,
            )
    return True


async def list_feedback(pool, unresolved_only: bool = True) -> list[dict]:
    async with pool.acquire() as conn:
        if unresolved_only:
            rows = await conn.fetch(
                "SELECT * FROM unit_feedback WHERE resolved = false ORDER BY created_at DESC"
            )
        else:
            rows = await conn.fetch("SELECT * FROM unit_feedback ORDER BY created_at DESC")
    return [dict(r) for r in rows]


async def resolve_feedback(pool, feedback_id: int) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE unit_feedback SET resolved = true WHERE id = $1", feedback_id
        )
    return result.split()[-1] != "0"


async def get_flagged_solutions(pool, unreviewed_only: bool = True) -> list[dict]:
    async with pool.acquire() as conn:
        if unreviewed_only:
            rows = await conn.fetch(
                "SELECT * FROM flagged_solutions WHERE reviewed = false ORDER BY flagged_at DESC"
            )
        else:
            rows = await conn.fetch("SELECT * FROM flagged_solutions ORDER BY flagged_at DESC")
    return [dict(r) for r in rows]


# ── Staged units ──────────────────────────────────────────────────────────────

async def get_staged_wiki_units(pool, status: str = "pending") -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM staged_wiki_units WHERE status = $1 ORDER BY created_at DESC", status
        )
    result = []
    for row in rows:
        d = dict(row)
        unit_data = json.loads(d.pop("unit_data"))
        result.append({**d, **unit_data})
    return result


async def approve_staged_wiki_unit(pool, staged_id: str) -> WikiUnit | None:
    now = datetime.now().isoformat()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT * FROM staged_wiki_units WHERE staged_id = $1 AND status = 'pending'",
                staged_id,
            )
            if not row:
                return None
            unit_data = json.loads(row["unit_data"])
            unit = WikiUnit(**unit_data)
            # upsert inside the same transaction
            existing = await conn.fetchrow(
                "SELECT version, content FROM wiki_units WHERE id = $1", unit.id
            )
            if existing:
                await conn.execute(
                    """INSERT INTO wiki_unit_history (unit_id, version, content, edited_by, reason)
                       VALUES ($1,$2,$3,$4,$5)""",
                    unit.id, existing["version"], existing["content"], None, "staged_approve",
                )
                await conn.execute(
                    """UPDATE wiki_units
                       SET type=$1, topic=$2, subtopic=$3, content=$4, problem_ids=$5,
                           source=$6, source_url=$7, version=$8, updated_at=$9
                       WHERE id=$10""",
                    unit.type, unit.topic, unit.subtopic, unit.content,
                    json.dumps(unit.problem_ids), row["source"], row["source_url"],
                    existing["version"] + 1, now, unit.id,
                )
            else:
                await conn.execute(
                    """INSERT INTO wiki_units
                       (id, type, topic, subtopic, content, problem_ids, source, source_url,
                        deleted, version, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,1,$9,$10)""",
                    unit.id, unit.type, unit.topic, unit.subtopic,
                    unit.content, json.dumps(unit.problem_ids), row["source"], row["source_url"],
                    now, now,
                )
            await conn.execute(
                "UPDATE staged_wiki_units SET status='approved', updated_at=$1 WHERE staged_id=$2",
                now, staged_id,
            )
    return unit


async def delete_staged_wiki_unit(pool, staged_id: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM staged_wiki_units WHERE staged_id = $1", staged_id)


# ── Drafts ────────────────────────────────────────────────────────────────────

async def create_draft(
    pool,
    source_text: str,
    source_url: str | None = None,
    topic_hint: str | None = None,
    proposed_units: list | None = None,
) -> str:
    import uuid
    draft_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO wiki_drafts
               (draft_id, source_url, source_text, proposed_units_json, topic_hint, status)
               VALUES ($1,$2,$3,$4,$5,$6)""",
            draft_id, source_url, source_text,
            json.dumps([u.model_dump() for u in proposed_units]) if proposed_units else "[]",
            topic_hint, "pending",
        )
    logger.info("Draft created: %s (%d units)", draft_id, len(proposed_units or []))
    return draft_id


async def get_draft(pool, draft_id: str) -> dict | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM wiki_drafts WHERE draft_id = $1", draft_id)
    return dict(row) if row else None


async def list_drafts(pool, status: str = "pending") -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM wiki_drafts WHERE status = $1 ORDER BY created_at DESC", status
        )
    return [dict(r) for r in rows]


async def review_draft(
    pool,
    draft_id: str,
    decision: str,
    reviewer: str = "admin",
    edits: list[dict] | None = None,
) -> dict:
    from app.math_wiki.schemas import WikiUnit as WU

    async with pool.acquire() as conn:
        draft_row = await conn.fetchrow("SELECT * FROM wiki_drafts WHERE draft_id = $1", draft_id)
        if not draft_row:
            raise ValueError(f"Draft {draft_id} not found")

        proposed = json.loads(draft_row["proposed_units_json"])
        final_units = proposed
        if edits:
            final_units = _apply_edits(proposed, edits)

        now = datetime.now().isoformat()
        if decision == "approve":
            for unit_data in final_units:
                unit = WU(**unit_data)
                await upsert_wiki_unit(pool, unit, source="manual", editor=reviewer, reason="Approved from draft")
            status = "approved"
        elif decision == "reject":
            status = "rejected"
        elif decision == "edit":
            await conn.execute(
                "UPDATE wiki_drafts SET final_units_json=$1, status='edited' WHERE draft_id=$2",
                json.dumps(final_units), draft_id,
            )
            return {"status": "edited", "draft_id": draft_id}
        else:
            raise ValueError(f"Invalid decision: {decision}")

        await conn.execute(
            "UPDATE wiki_drafts SET status=$1, reviewed_by=$2, reviewed_at=$3, final_units_json=$4 WHERE draft_id=$5",
            status, reviewer, now, json.dumps(final_units), draft_id,
        )

    logger.info("Draft %s %s by %s", draft_id, status, reviewer)
    return {"status": status, "draft_id": draft_id, "units_created": len(final_units) if decision == "approve" else 0}


def _apply_edits(proposed: list[dict], edits: list[dict]) -> list[dict]:
    units = [u.copy() for u in proposed]
    for edit in edits:
        field = edit.get("field")
        new_val = edit.get("new")
        target_id = edit.get("unit_id")
        if not field:
            continue
        for u in units:
            if target_id and u.get("id") != target_id:
                continue
            if field in u:
                u[field] = new_val
    return units
