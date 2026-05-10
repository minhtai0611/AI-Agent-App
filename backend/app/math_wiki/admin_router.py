import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.config import get_settings
from app.dependencies import get_ai_client
from app.math_wiki.storage import pg_db
from app.math_wiki.storage.analytics import get_retrieval_effectiveness, get_unit_usage_stats
from app.math_wiki.schemas import WikiUnit, StagedWikiUnit
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# ── Crawl job state (in-process singleton, one crawl at a time) ───────────────

_crawl: dict = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "topics": [],
    "sources": [],
    "dry_run": False,
    "stats": {},
    "current_topic": None,
    "error": None,
}


def _check_admin_key(x_admin_key: str = Header(...)):
    settings = get_settings()
    expected = getattr(settings, "admin_key", None)
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key")


def _get_pool(request: Request):
    return request.app.state.pool


# ── Wiki Units ────────────────────────────────────────────────────────────────

@router.get("/units")
async def admin_list_units(
    topic: str | None = Query(None),
    source: str | None = Query(None),
    include_deleted: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    units = await pg_db.list_wiki_units_admin(
        pool, topic=topic, source=source,
        include_deleted=include_deleted,
        limit=limit, offset=offset,
    )
    return {"units": units, "count": len(units)}


@router.get("/staged-units", response_model=list[StagedWikiUnit])
async def admin_list_staged_units(
    status: str = Query("pending"),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    return await pg_db.get_staged_wiki_units(pool, status=status)


@router.post("/staged-units/{unit_id}/approve")
async def admin_approve_staged_unit(
    unit_id: str,
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    try:
        approved_unit = await pg_db.approve_staged_wiki_unit(pool, unit_id)
        if approved_unit:
            return {"status": "approved", "id": unit_id}
        raise HTTPException(status_code=404, detail="Staged unit not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/staged-units/{unit_id}")
async def admin_delete_staged_unit(
    unit_id: str,
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    try:
        await pg_db.delete_staged_wiki_unit(pool, unit_id)
        return {"status": "deleted", "id": unit_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/units/{unit_id}")
async def admin_get_unit(
    unit_id: str,
    include_history: bool = Query(False),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    result = await pg_db.get_wiki_unit_with_history(pool, unit_id)
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
async def admin_update_unit(
    unit_id: str,
    req: UnitUpdateRequest,
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    data = await pg_db.get_wiki_unit_with_history(pool, unit_id)
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
    await pg_db.upsert_wiki_unit(pool, updated, source=row["source"], editor=req.editor, reason=req.reason)
    return {"status": "updated", "id": unit_id}


@router.delete("/units/{unit_id}")
async def admin_delete_unit(
    unit_id: str,
    editor: str = Query("admin"),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    ok = await pg_db.soft_delete_wiki_unit(pool, unit_id, editor=editor)
    if not ok:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"status": "deleted", "id": unit_id}


@router.post("/units/{unit_id}/restore")
async def admin_restore_unit(
    unit_id: str,
    version: int | None = Query(None),
    editor: str = Query("admin"),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    ok = await pg_db.restore_wiki_unit(pool, unit_id, version=version, editor=editor)
    if not ok:
        raise HTTPException(status_code=404, detail="Unit or version not found")
    return {"status": "restored", "id": unit_id}


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/feedback")
async def admin_list_feedback(
    unresolved_only: bool = Query(True),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    rows = await pg_db.list_feedback(pool, unresolved_only=unresolved_only)
    return {"feedback": rows, "count": len(rows)}


@router.post("/feedback/{feedback_id}/resolve")
async def admin_resolve_feedback(
    feedback_id: int,
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    ok = await pg_db.resolve_feedback(pool, feedback_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"status": "resolved", "id": feedback_id}


# ── Flagged solutions ─────────────────────────────────────────────────────────

@router.get("/flagged")
async def admin_list_flagged(
    unreviewed_only: bool = Query(True),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    rows = await pg_db.get_flagged_solutions(pool, unreviewed_only=unreviewed_only)
    return {"flagged": rows, "count": len(rows)}


# ── Drafts ────────────────────────────────────────────────────────────────────

@router.get("/drafts")
async def admin_list_drafts(
    status: str = Query("pending"),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    rows = await pg_db.list_drafts(pool, status=status)
    return {"drafts": rows, "count": len(rows)}


class DraftReviewRequest(BaseModel):
    decision: str  # approve | reject | edit
    reviewer: str = "admin"
    edits: list[dict] | None = None


@router.post("/drafts/{draft_id}/review")
async def admin_review_draft(
    draft_id: str,
    req: DraftReviewRequest,
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    try:
        result = await pg_db.review_draft(
            pool,
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
    pool=Depends(_get_pool),
):
    from app.math_wiki.agents.concept_ingest import concept_ingest
    try:
        output = await concept_ingest(client, req.text, pool=pool)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI ingest failed: {exc}")

    draft_id = await pg_db.create_draft(
        pool,
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
async def admin_analytics(
    days: int = Query(30, ge=1, le=365),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    return await get_retrieval_effectiveness(pool, days=days)


@router.get("/analytics/units/{unit_id}")
async def admin_unit_analytics(
    unit_id: str,
    days: int = Query(30, ge=1, le=365),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    all_stats = await get_unit_usage_stats(pool, days=days)
    unit_stats = next((s for s in all_stats if s["unit_id"] == unit_id), None)
    if not unit_stats:
        return {"unit_id": unit_id, "times_used": 0, "message": "no data"}
    return unit_stats


# ── Crawl trigger ─────────────────────────────────────────────────────────────

class CrawlRequest(BaseModel):
    gap_threshold: int = 50          # crawl topics with fewer units than this
    sources: list[str] = ["aops", "pauls", "generic"]
    dry_run: bool = False


async def _run_crawl(client, pool, topics: list[str], sources: list[str], dry_run: bool) -> None:
    from crawl.runner import crawl_and_ingest

    _crawl["current_topic"] = None
    combined: dict = {
        "topics": len(topics),
        "pages_fetched": 0,
        "chunks_sent": 0,
        "wiki_units_added": 0,
        "skipped_seen": 0,
        "errors": 0,
    }
    try:
        for topic in topics:
            _crawl["current_topic"] = topic
            stats = await crawl_and_ingest(
                client, topics=[topic], sources=sources, dry_run=dry_run, pool=pool
            )
            for k in ("pages_fetched", "chunks_sent", "wiki_units_added", "skipped_seen", "errors"):
                combined[k] = combined.get(k, 0) + stats.get(k, 0)
            _crawl["stats"] = dict(combined)
            logger.info("crawl [%s]: %s", topic, stats)
            await asyncio.sleep(3)   # inter-topic pause
    except Exception as exc:
        _crawl["error"] = str(exc)
        logger.error("admin crawl failed: %s", exc)
    finally:
        _crawl["running"] = False
        _crawl["finished_at"] = datetime.now(timezone.utc).isoformat()
        _crawl["current_topic"] = None
        _crawl["stats"] = dict(combined)


@router.post("/crawl")
async def admin_trigger_crawl(
    req: CrawlRequest,
    request: Request,
    client: AsyncOpenAI = Depends(get_ai_client),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    if _crawl["running"]:
        return {
            "status": "already_running",
            "started_at": _crawl["started_at"],
            "current_topic": _crawl["current_topic"],
        }

    from app.math_wiki.taxonomy import CANONICAL_TOPICS

    topic_counts = await pg_db.count_wiki_units_by_topic(pool)
    gap_topics = [
        t for t in CANONICAL_TOPICS
        if topic_counts.get(t, 0) < req.gap_threshold
    ]

    if not gap_topics:
        return {"status": "no_gaps", "message": f"All topics have ≥ {req.gap_threshold} units"}

    _crawl.update({
        "running": True,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "topics": gap_topics,
        "sources": req.sources,
        "dry_run": req.dry_run,
        "stats": {},
        "current_topic": None,
        "error": None,
    })

    asyncio.ensure_future(_run_crawl(client, pool, gap_topics, req.sources, req.dry_run))

    return {
        "status": "started",
        "topics": gap_topics,
        "gap_threshold": req.gap_threshold,
        "sources": req.sources,
        "dry_run": req.dry_run,
    }


@router.get("/crawl/status")
async def admin_crawl_status(_: None = Depends(_check_admin_key)):
    return {
        "running": _crawl["running"],
        "started_at": _crawl["started_at"],
        "finished_at": _crawl["finished_at"],
        "topics_queued": _crawl["topics"],
        "current_topic": _crawl["current_topic"],
        "sources": _crawl["sources"],
        "dry_run": _crawl["dry_run"],
        "stats": _crawl["stats"],
        "error": _crawl["error"],
    }


# ── Sanitize ──────────────────────────────────────────────────────────────────

@router.post("/sanitize")
async def admin_sanitize(
    dry_run: bool = Query(False, description="Report changes without applying them"),
    _: None = Depends(_check_admin_key),
    pool=Depends(_get_pool),
):
    """Fix non-canonical topic/type labels and remove content-duplicate wiki units."""
    from app.math_wiki.storage.sanitizer import run_all
    report = await run_all(pool, dry_run=dry_run)
    return report
