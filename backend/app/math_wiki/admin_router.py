import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.config import get_settings
from app.dependencies import get_ai_client
from app.math_wiki.storage.db import (
    list_wiki_units_admin,
    get_wiki_unit_with_history,
    upsert_wiki_unit,
    soft_delete_wiki_unit,
    restore_wiki_unit,
    list_feedback,
    resolve_feedback,
    get_flagged_solutions,
    count_wiki_units,
    get_staged_wiki_units,
    approve_staged_wiki_unit,
    delete_staged_wiki_unit,
)
from app.math_wiki.storage.queue import list_drafts, review_draft, create_draft
from app.math_wiki.storage.analytics import get_retrieval_effectiveness, get_unit_usage_stats
from app.math_wiki.schemas import WikiUnit, StagedWikiUnit
from app.math_wiki.pipeline import _append_to_indexes # Import _append_to_indexes
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def _check_admin_key(x_admin_key: str = Header(...)):
    settings = get_settings()
    expected = getattr(settings, "admin_key", None)
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key")


# ── Wiki Units ────────────────────────────────────────────────────────────────

@router.get("/units")
def admin_list_units(
    topic: str | None = Query(None),
    source: str | None = Query(None),
    include_deleted: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: None = Depends(_check_admin_key),
):
    units = list_wiki_units_admin(
        topic=topic, source=source,
        include_deleted=include_deleted,
        limit=limit, offset=offset,
    )
    return {"units": units, "count": len(units)}


@router.get("/staged-units", response_model=list[StagedWikiUnit])
def admin_list_staged_units(
    status: str = Query("pending"),
    _: None = Depends(_check_admin_key),
):
    return get_staged_wiki_units(status=status)


@router.post("/staged-units/{unit_id}/approve")
async def admin_approve_staged_unit(
    unit_id: str,
    _: None = Depends(_check_admin_key),
):
    try:
        approved_unit = approve_staged_wiki_unit(unit_id)
        if approved_unit:
            await asyncio.get_event_loop().run_in_executor(None, _append_to_indexes, [approved_unit])
            return {"status": "approved", "id": unit_id}
        raise HTTPException(status_code=404, detail="Staged unit not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/staged-units/{unit_id}")
def admin_delete_staged_unit(
    unit_id: str,
    _: None = Depends(_check_admin_key),
):
    try:
        delete_staged_wiki_unit(unit_id)
        return {"status": "deleted", "id": unit_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/units/{unit_id}")
def admin_get_unit(
    unit_id: str,
    include_history: bool = Query(False),
    _: None = Depends(_check_admin_key),
):
    result = get_wiki_unit_with_history(unit_id)
    if not result:
        raise HTTPException(status_code=404, detail="Unit not found")
    if not include_history:
        result.pop("history", None)
    return result


class UnitUpdateRequest(BaseModel):
    content: str
    editor: str = "admin"
    reason: str | None = None


@router.put("/units/{unit_id}")
def admin_update_unit(
    unit_id: str,
    req: UnitUpdateRequest,
    _: None = Depends(_check_admin_key),
):
    data = get_wiki_unit_with_history(unit_id)
    if not data:
        raise HTTPException(status_code=404, detail="Unit not found")
    row = data["unit"]
    updated = WikiUnit(
        id=row["id"],
        type=row["type"],
        topic=row["topic"],
        subtopic=row["subtopic"],
        content=req.content,
        problem_ids=json.loads(row["problem_ids"]) if isinstance(row["problem_ids"], str) else row["problem_ids"],
    )
    upsert_wiki_unit(updated, source=row["source"], editor=req.editor, reason=req.reason)
    return {"status": "updated", "id": unit_id}


@router.delete("/units/{unit_id}")
def admin_delete_unit(
    unit_id: str,
    editor: str = Query("admin"),
    _: None = Depends(_check_admin_key),
):
    ok = soft_delete_wiki_unit(unit_id, editor=editor)
    if not ok:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"status": "deleted", "id": unit_id}


@router.post("/units/{unit_id}/restore")
def admin_restore_unit(
    unit_id: str,
    version: int | None = Query(None),
    editor: str = Query("admin"),
    _: None = Depends(_check_admin_key),
):
    ok = restore_wiki_unit(unit_id, version=version, editor=editor)
    if not ok:
        raise HTTPException(status_code=404, detail="Unit or version not found")
    return {"status": "restored", "id": unit_id}


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/feedback")
def admin_list_feedback(
    unresolved_only: bool = Query(True),
    _: None = Depends(_check_admin_key),
):
    rows = list_feedback(unresolved_only=unresolved_only)
    return {"feedback": rows, "count": len(rows)}


@router.post("/feedback/{feedback_id}/resolve")
def admin_resolve_feedback(
    feedback_id: int,
    _: None = Depends(_check_admin_key),
):
    ok = resolve_feedback(feedback_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"status": "resolved", "id": feedback_id}


# ── Flagged solutions ─────────────────────────────────────────────────────────

@router.get("/flagged")
def admin_list_flagged(
    unreviewed_only: bool = Query(True),
    _: None = Depends(_check_admin_key),
):
    rows = get_flagged_solutions(unreviewed_only=unreviewed_only)
    return {"flagged": rows, "count": len(rows)}


# ── Drafts ────────────────────────────────────────────────────────────────────

@router.get("/drafts")
def admin_list_drafts(
    status: str = Query("pending"),
    _: None = Depends(_check_admin_key),
):
    rows = list_drafts(status=status)
    return {"drafts": rows, "count": len(rows)}


class DraftReviewRequest(BaseModel):
    decision: str  # approve | reject | edit
    reviewer: str = "admin"
    edits: list[dict] | None = None


@router.post("/drafts/{draft_id}/review")
def admin_review_draft(
    draft_id: str,
    req: DraftReviewRequest,
    _: None = Depends(_check_admin_key),
):
    try:
        result = review_draft(
            draft_id=draft_id,
            decision=req.decision,
            reviewer=req.reviewer,
            edits=req.edits,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


# ── Source ingest → draft ─────────────────────────────────────────────────────

class IngestSourceRequest(BaseModel):
    text: str
    source_url: str | None = None
    topic_hint: str | None = None


@router.post("/ingest/source")
async def admin_ingest_source(
    req: IngestSourceRequest,
    client: AsyncOpenAI = Depends(get_ai_client),
    _: None = Depends(_check_admin_key),
):
    from app.math_wiki.agents.concept_ingest import concept_ingest
    try:
        output = await concept_ingest(client, req.text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI ingest failed: {exc}")

    draft_id = create_draft(
        source_text=req.text,
        source_url=req.source_url,
        topic_hint=req.topic_hint,
        proposed_units=output.wiki_units if hasattr(output, "wiki_units") else [],
    )
    return {
        "draft_id": draft_id,
        "proposed_unit_count": len(output.wiki_units) if hasattr(output, "wiki_units") else 0,
    }


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
def admin_analytics(
    days: int = Query(30, ge=1, le=365),
    _: None = Depends(_check_admin_key),
):
    return get_retrieval_effectiveness(days=days)


@router.get("/analytics/units/{unit_id}")
def admin_unit_analytics(
    unit_id: str,
    days: int = Query(30, ge=1, le=365),
    _: None = Depends(_check_admin_key),
):
    all_stats = get_unit_usage_stats(days=days)
    unit_stats = next((s for s in all_stats if s["unit_id"] == unit_id), None)
    if not unit_stats:
        return {"unit_id": unit_id, "times_used": 0, "message": "no data"}
    return unit_stats
