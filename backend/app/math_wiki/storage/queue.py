import uuid
import json
import logging
from datetime import datetime
from typing import Optional
from app.math_wiki.storage.db import _get_conn, _ensure_tables
from app.math_wiki.schemas import WikiUnit

logger = logging.getLogger(__name__)


def create_draft(
    source_text: str,
    source_url: Optional[str] = None,
    topic_hint: Optional[str] = None,
    proposed_units: Optional[list[WikiUnit]] = None,
) -> str:
    """Create a new draft from external source text. Returns draft_id."""
    draft_id = str(uuid.uuid4())
    with _get_conn() as conn:
        _ensure_tables(conn)
        conn.execute(
            """
            INSERT INTO wiki_drafts
                (draft_id, source_url, source_text, proposed_units_json, topic_hint, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                draft_id,
                source_url,
                source_text,
                json.dumps([u.model_dump() for u in proposed_units]) if proposed_units else "[]",
                topic_hint,
                "pending",
            ),
        )
        conn.commit()
    logger.info("Draft created: %s (%d units)", draft_id, len(proposed_units or []))
    return draft_id


def get_draft(draft_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        row = conn.execute("SELECT * FROM wiki_drafts WHERE draft_id = ?", (draft_id,)).fetchone()
        return dict(row) if row else None


def list_drafts(status: str = "pending") -> list[dict]:
    with _get_conn() as conn:
        _ensure_tables(conn)
        rows = conn.execute(
            "SELECT * FROM wiki_drafts WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
        return [dict(r) for r in rows]


def review_draft(
    draft_id: str,
    decision: str,
    reviewer: str = "admin",
    edits: Optional[list[dict]] = None,
) -> dict:
    """Approve or reject a draft. If approve, creates/updates wiki_units."""
    from app.math_wiki.storage.db import upsert_wiki_unit

    with _get_conn() as conn:
        _ensure_tables(conn)
        draft_row = conn.execute("SELECT * FROM wiki_drafts WHERE draft_id = ?", (draft_id,)).fetchone()
        if not draft_row:
            raise ValueError(f"Draft {draft_id} not found")

        proposed = json.loads(draft_row["proposed_units_json"])
        final_units = proposed

        if edits:
            # Apply edits to proposed units (simplistic merge)
            final_units = _apply_edits(proposed, edits)

        if decision == "approve":
            for unit_data in final_units:
                unit = WikiUnit(**unit_data)
                upsert_wiki_unit(unit, source="manual", editor=reviewer, reason="Approved from draft")
            status = "approved"
        elif decision == "reject":
            status = "rejected"
        elif decision == "edit":
            # Save edited units back as new draft? For now mark as edited pending
            conn.execute(
                "UPDATE wiki_drafts SET final_units_json = ?, status = 'edited' WHERE draft_id = ?",
                (json.dumps(final_units), draft_id),
            )
            conn.commit()
            return {"status": "edited", "draft_id": draft_id}
        else:
            raise ValueError(f"Invalid decision: {decision}")

        conn.execute(
            "UPDATE wiki_drafts SET status = ?, reviewed_by = ?, reviewed_at = ?, final_units_json = ? WHERE draft_id = ?",
            (status, reviewer, datetime.now().isoformat(), json.dumps(final_units), draft_id),
        )
        conn.commit()
    logger.info("Draft %s %s by %s", draft_id, status, reviewer)
    return {"status": status, "draft_id": draft_id, "units_created": len(final_units) if decision == "approve" else 0}


def _apply_edits(proposed: list[dict], edits: list[dict]) -> list[dict]:
    """Apply a list of edit operations to proposed units.

    Each edit: {field, new, unit_id?}
    If unit_id is present, apply only to that unit; otherwise apply to all units.
    """
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
