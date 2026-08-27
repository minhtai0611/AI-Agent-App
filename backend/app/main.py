import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

logger = logging.getLogger(__name__)

_SCHEMA_DDL = [
    """CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        year INTEGER,
        title TEXT NOT NULL,
        duration INTEGER,
        source TEXT,
        category TEXT NOT NULL,
        mode TEXT,
        total_questions INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        source TEXT,
        year INTEGER,
        topic TEXT,
        difficulty TEXT,
        question TEXT NOT NULL,
        choices TEXT NOT NULL,
        correct INTEGER NOT NULL,
        explanation TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS exam_questions (
        exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (exam_id, question_id)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_eq_exam ON exam_questions(exam_id)",
    "CREATE INDEX IF NOT EXISTS idx_q_topic ON questions(topic)",
    # Additive columns for the content pipeline (Ascent Roadmap Phase 1/3) — not CREATE IF
    # NOT EXISTS like the rest of this list, so failures on a re-run are expected and are
    # swallowed by _apply_schema's per-statement try/except below.
    "ALTER TABLE questions ADD COLUMN origin TEXT DEFAULT 'human'",
    "ALTER TABLE questions ADD COLUMN qti_identifier TEXT",
    """CREATE TABLE IF NOT EXISTS content_reports (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES questions(id),
        kind TEXT NOT NULL,
        note TEXT,
        reported_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS pending_questions (
        id TEXT PRIMARY KEY,
        draft_json TEXT NOT NULL,
        status TEXT NOT NULL,
        verification_log TEXT,
        attempt INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS content_ledger (
        content_hash TEXT PRIMARY KEY,
        topic TEXT,
        difficulty TEXT,
        status TEXT NOT NULL,
        verified_at TEXT DEFAULT (datetime('now'))
    )""",
    # Pure Mathematics Toolset Phase 1 — cached AI-generated 3D visualization specs,
    # keyed by question_id since they're optional/regenerable, not a questions column.
    """CREATE TABLE IF NOT EXISTS question_visualizations (
        question_id TEXT PRIMARY KEY REFERENCES questions(id),
        status TEXT NOT NULL,
        template TEXT,
        params_json TEXT,
        annotation TEXT,
        verification_log TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    # Pure Mathematics Toolset Phase 3 — cached AI-narrated, sympy-verified step-by-step
    # solutions, keyed by question_id for the same reason as question_visualizations.
    """CREATE TABLE IF NOT EXISTS question_steps (
        question_id TEXT PRIMARY KEY REFERENCES questions(id),
        status TEXT NOT NULL,
        steps_json TEXT,
        verification_log TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    # Institutions Phase 1 — org/tenant model, SSO/SCIM identity, RBAC, audit log.
    """CREATE TABLE IF NOT EXISTS orgs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workos_org_id TEXT UNIQUE,
        domain TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS org_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        workos_user_id TEXT,
        role TEXT NOT NULL DEFAULT 'learner',
        source TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(org_id, email)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id)",
    "CREATE INDEX IF NOT EXISTS idx_org_members_workos_user ON org_members(workos_user_id)",
    """CREATE TABLE IF NOT EXISTS org_sessions (
        id TEXT PRIMARY KEY,
        org_member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
        workos_access_token TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    "CREATE INDEX IF NOT EXISTS idx_org_sessions_member ON org_sessions(org_member_id)",
    """CREATE TABLE IF NOT EXISTS org_audit_log (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        actor_member_id TEXT REFERENCES org_members(id),
        action TEXT NOT NULL,
        target TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    "CREATE INDEX IF NOT EXISTS idx_org_audit_org ON org_audit_log(org_id)",
    # Institutions Phase 2 — branding, cohorts, org content library, attempts/analytics,
    # integrations & webhooks, compliance. Additive columns on orgs (ALTER, not CREATE IF
    # NOT EXISTS — expected to fail-and-be-swallowed on re-run, same convention as the
    # origin/qti_identifier columns above).
    "ALTER TABLE orgs ADD COLUMN branding_logo_url TEXT",
    "ALTER TABLE orgs ADD COLUMN branding_primary_color TEXT",
    "ALTER TABLE orgs ADD COLUMN branding_secondary_color TEXT",
    "ALTER TABLE orgs ADD COLUMN support_tier TEXT DEFAULT 'standard'",
    "ALTER TABLE orgs ADD COLUMN status_page_url TEXT",
    "ALTER TABLE orgs ADD COLUMN retention_days INTEGER",
    """CREATE TABLE IF NOT EXISTS org_cohorts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        external_ref TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS org_cohort_members (
        cohort_id TEXT NOT NULL REFERENCES org_cohorts(id) ON DELETE CASCADE,
        org_member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
        PRIMARY KEY (cohort_id, org_member_id)
    )""",
    """CREATE TABLE IF NOT EXISTS org_content_items (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        source_question_id TEXT REFERENCES questions(id),
        question TEXT,
        choices TEXT,
        correct INTEGER,
        explanation TEXT,
        topic TEXT,
        difficulty TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        created_by TEXT REFERENCES org_members(id),
        approved_by TEXT REFERENCES org_members(id),
        approved_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS org_exams (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_by TEXT REFERENCES org_members(id),
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS org_exam_items (
        org_exam_id TEXT NOT NULL REFERENCES org_exams(id) ON DELETE CASCADE,
        question_id TEXT REFERENCES questions(id),
        org_content_item_id TEXT REFERENCES org_content_items(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (org_exam_id, position)
    )""",
    """CREATE TABLE IF NOT EXISTS org_exam_attempts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        cohort_id TEXT REFERENCES org_cohorts(id),
        org_member_id TEXT NOT NULL REFERENCES org_members(id),
        exam_ref_type TEXT NOT NULL,
        exam_id TEXT NOT NULL,
        score REAL,
        item_responses TEXT,
        started_at TEXT,
        submitted_at TEXT DEFAULT (datetime('now')),
        source TEXT DEFAULT 'web'
    )""",
    "CREATE INDEX IF NOT EXISTS idx_attempts_org_cohort ON org_exam_attempts(org_id, cohort_id)",
    """CREATE TABLE IF NOT EXISTS org_api_keys (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL,
        label TEXT,
        scopes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        revoked_at TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS org_webhooks (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        event_types TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS org_webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL REFERENCES org_webhooks(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        delivered_at TEXT
    )""",
    # Institutions Phase 3 — tiered AI proctoring (scaffold, no vendor wired), org-scoped
    # AI generation with a human-review gate, psychometric flagging, predictive cohort
    # signals, plain-language narration.
    "ALTER TABLE exams ADD COLUMN stakes_tier TEXT DEFAULT 'low'",
    """CREATE TABLE IF NOT EXISTS org_proctoring_settings (
        org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
        tier_enabled TEXT NOT NULL DEFAULT 'none',
        vendor_config TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS proctoring_sessions (
        id TEXT PRIMARY KEY,
        exam_attempt_id TEXT,
        org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        tier TEXT NOT NULL,
        vendor_session_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        flags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
    )""",
    "ALTER TABLE pending_questions ADD COLUMN org_id TEXT",
    "ALTER TABLE pending_questions ADD COLUMN content_library_id TEXT",
    """CREATE TABLE IF NOT EXISTS question_response_stats (
        question_id TEXT NOT NULL,
        org_id TEXT,
        choice_index INTEGER NOT NULL,
        pick_count INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        total_attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (question_id, org_id, choice_index)
    )""",
    """CREATE TABLE IF NOT EXISTS psychometric_flags (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        org_id TEXT,
        flag_type TEXT NOT NULL,
        metric_value REAL,
        detail TEXT,
        flagged_at TEXT DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'open'
    )""",
    """CREATE TABLE IF NOT EXISTS cohort_risk_signals (
        id TEXT PRIMARY KEY,
        cohort_id TEXT,
        org_id TEXT NOT NULL,
        org_member_id TEXT,
        signal_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        detail_json TEXT NOT NULL DEFAULT '{}',
        computed_at TEXT DEFAULT (datetime('now'))
    )""",
]


async def _apply_schema(pool) -> None:
    """Run DDL idempotently on every startup — all statements are CREATE IF NOT EXISTS."""
    async with pool.acquire() as conn:
        for stmt in _SCHEMA_DDL:
            try:
                await conn.execute(stmt)
            except Exception as exc:
                logger.warning("DDL skipped (%s): %.80s", exc, stmt)
    logger.info("Schema applied (%d statements)", len(_SCHEMA_DDL))


async def _seed_from_json(pool) -> None:
    """Auto-seed exams and questions tables from bundled JSON files (runs once, INSERT OR IGNORE)."""
    data_dir = Path(__file__).parent.parent.parent / "exam-app" / "src" / "data"
    try:
        exams_path = data_dir / "exams.json"
        questions_path = data_dir / "questions.json"
        if not exams_path.exists() or not questions_path.exists():
            logger.warning("_seed_from_json: JSON files not found at %s — skipping seed", data_dir)
            return
        exams = json.loads(exams_path.read_text(encoding="utf-8"))
        questions = json.loads(questions_path.read_text(encoding="utf-8"))
        async with pool.acquire() as conn:
            async with conn.transaction():
                for e in exams:
                    await conn.execute(
                        "INSERT OR IGNORE INTO exams (id, year, title, duration, source, category, mode, total_questions) VALUES (?,?,?,?,?,?,?,?)",
                        e["id"], e.get("year"), e["title"], e.get("duration"), e.get("source"),
                        e["category"], e.get("mode"), e.get("totalQuestions"),
                    )
                for q in questions:
                    await conn.execute(
                        "INSERT OR IGNORE INTO questions (id, source, year, topic, difficulty, question, choices, correct, explanation) VALUES (?,?,?,?,?,?,?,?,?)",
                        q["id"], q.get("source"), q.get("year"), q.get("topic"), q.get("difficulty"),
                        q["question"], json.dumps(q.get("choices", []), ensure_ascii=False),
                        q["correct"], q.get("explanation"),
                    )
                for e in exams:
                    for i, qid in enumerate(e.get("questionIds", [])):
                        await conn.execute(
                            "INSERT OR IGNORE INTO exam_questions (exam_id, question_id, position) VALUES (?,?,?)",
                            e["id"], qid, i,
                        )
        logger.info("_seed_from_json: seeded %d exams, %d questions", len(exams), len(questions))
    except Exception as exc:
        logger.warning("_seed_from_json failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db import AsyncSQLitePool

    settings = get_settings()
    pool = AsyncSQLitePool(settings.sqlite_path)
    await pool.initialize()
    app.state.pool = pool
    await _apply_schema(app.state.pool)
    logger.info("SQLite pool ready at %s", settings.sqlite_path)

    exam_count = await app.state.pool.fetchrow("SELECT COUNT(*) AS cnt FROM exams")
    q_count = await app.state.pool.fetchrow("SELECT COUNT(*) AS cnt FROM questions")
    if (exam_count and exam_count["cnt"] == 0) or (q_count and q_count["cnt"] == 0):
        await _seed_from_json(app.state.pool)

    retry_task = None
    if settings.webhook_retry_enabled:
        from app.webhooks import retry_sweep_loop

        retry_task = asyncio.create_task(retry_sweep_loop(app.state.pool))

    yield

    if retry_task:
        retry_task.cancel()
    if app.state.pool:
        await app.state.pool.close()


def get_pool(request: Request):
    return getattr(request.app.state, "pool", None)


app = FastAPI(title="AI Agent App", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok"}


@app.get("/exams")
async def list_exams(mode: str | None = None, pool=Depends(get_pool)):
    if mode:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE mode=? ORDER BY year DESC",
            mode,
        )
    else:
        rows = await pool.fetch(
            "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE mode!='retired' ORDER BY year DESC"
        )
    return [dict(r) for r in rows]


@app.get("/exams/{exam_id}")
async def get_exam(exam_id: str, pool=Depends(get_pool)):
    exam = await pool.fetchrow(
        "SELECT id,year,title,duration,source,category,mode,total_questions AS totalQuestions FROM exams WHERE id=?",
        exam_id,
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    q_ids = await pool.fetch(
        "SELECT question_id FROM exam_questions WHERE exam_id=? ORDER BY position", exam_id
    )
    return {**dict(exam), "questionIds": [r["question_id"] for r in q_ids]}


@app.post("/questions/batch")
async def batch_questions(body: dict, pool=Depends(get_pool)):
    ids = body.get("ids", [])[:200]
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    rows = await pool.fetch(f"SELECT * FROM questions WHERE id IN ({placeholders})", *ids)
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


@app.get("/questions")
async def all_questions(topic: str | None = None, pool=Depends(get_pool)):
    if topic:
        rows = await pool.fetch("SELECT * FROM questions WHERE topic=?", topic)
    else:
        rows = await pool.fetch("SELECT * FROM questions")
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


@app.post("/questions/{question_id}/report")
async def report_question(question_id: str, body: dict, pool=Depends(get_pool)):
    """Content-issue reporting (Phase 2) — a bug report on the content, not a survey.

    kind: one of render | answer_key | ambiguous | other
    """
    exists = await pool.fetchrow("SELECT id FROM questions WHERE id=?", question_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Question not found")
    kind = body.get("kind")
    if kind not in {"render", "answer_key", "ambiguous", "other"}:
        raise HTTPException(status_code=422, detail="kind must be one of render, answer_key, ambiguous, other")
    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO content_reports (id, question_id, kind, note) VALUES (?,?,?,?)",
        report_id, question_id, kind, body.get("note"),
    )
    return {"id": report_id, "questionId": question_id, "kind": kind}


@app.get("/content-reports")
async def list_content_reports(kind: str | None = None, pool=Depends(get_pool)):
    """Review queue for content_reports — student-submitted (ReportIssueButton) and
    AI-audit-filed (note prefixed 'AI audit:') rows live in the same table/kind space.
    """
    query = (
        "SELECT r.id, r.question_id AS questionId, r.kind, r.note, r.reported_at AS reportedAt, "
        "q.question, q.choices, q.correct FROM content_reports r "
        "JOIN questions q ON q.id = r.question_id"
    )
    if kind:
        rows = await pool.fetch(query + " WHERE r.kind=? ORDER BY r.reported_at DESC", kind)
    else:
        rows = await pool.fetch(query + " ORDER BY r.reported_at DESC")
    return [{**dict(r), "choices": json.loads(r["choices"])} for r in rows]


def _get_router_client():
    from app.agent.router_client import AiRouterClient, RouterNotConfiguredError

    try:
        return AiRouterClient(get_settings())
    except RouterNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/agent/generate")
async def agent_generate(body: dict, pool=Depends(get_pool)):
    """Phase 3 — draft, independently verify, and auto-promote math questions.

    Body: {topic, difficulty, count} — count is capped at 10 per call to keep a single
    request bounded; batching a larger run is the caller's job, not this endpoint's.
    """
    from app.agent.orchestrator import generate_batch

    topic = body.get("topic")
    difficulty = body.get("difficulty")
    count = min(int(body.get("count", 1)), 10)
    if not topic or not difficulty:
        raise HTTPException(status_code=422, detail="topic and difficulty are required")

    client = _get_router_client()
    results = await generate_batch(pool, client, topic, difficulty, count)
    return {"results": results}


@app.post("/agent/audit")
async def agent_audit(body: dict, pool=Depends(get_pool)):
    """Audits existing questions already in the bank (static or agent-origin) — independent
    of /agent/generate's write-path gate. A mismatch auto-files a content_reports row
    (kind='answer_key') for human review; it never rewrites the stored answer itself.

    Body: {question_ids: [...]} — capped at 20 per call, same bounded-request rule as
    /agent/generate.
    """
    from app.agent.auditor import audit_question

    question_ids = body.get("question_ids", [])[:20]
    if not question_ids:
        raise HTTPException(status_code=422, detail="question_ids is required")

    client = _get_router_client()
    results = []
    for qid in question_ids:
        row = await pool.fetchrow("SELECT id, question, choices, correct FROM questions WHERE id=?", qid)
        if not row:
            results.append({"questionId": qid, "status": "not_found"})
            continue

        question_row = {**dict(row), "choices": json.loads(row["choices"])}
        result = await audit_question(client, question_row)

        if result.status == "mismatch":
            report_id = f"rpt_{uuid.uuid4().hex[:12]}"
            await pool.execute(
                "INSERT INTO content_reports (id, question_id, kind, note) VALUES (?,?,?,?)",
                report_id, qid, "answer_key", f"AI audit: {result.reason}",
            )

        results.append({
            "questionId": qid,
            "status": result.status,
            "storedIndex": result.stored_index,
            "verifiedIndex": result.verified_index,
            "reason": result.reason,
        })
    return {"results": results}


@app.get("/agent/pending")
async def agent_pending(status: str | None = None, pool=Depends(get_pool)):
    if status:
        rows = await pool.fetch("SELECT * FROM pending_questions WHERE status=? ORDER BY created_at DESC", status)
    else:
        rows = await pool.fetch("SELECT * FROM pending_questions ORDER BY created_at DESC")
    return [dict(r) for r in rows]


@app.post("/agent/pending/{pending_id}/reject")
async def agent_reject_pending(pending_id: str, pool=Depends(get_pool)):
    """Manual override for a verified-but-suspect item — the safety valve, not the default path."""
    row = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=?", pending_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pending item not found")
    await pool.execute("UPDATE pending_questions SET status='rejected' WHERE id=?", pending_id)
    return {"id": pending_id, "status": "rejected"}


def _visualization_row_to_result(row) -> dict:
    return {
        "available": row["status"] == "verified",
        "spec": json.loads(row["params_json"]) if row["params_json"] else None,
        "annotation": row["annotation"],
        "reason": None if row["status"] == "verified" else row["verification_log"],
    }


@app.get("/agent/visualize/{question_id}")
async def agent_get_visualization(question_id: str, pool=Depends(get_pool)):
    """Cache-only read — never triggers generation. The Concept Explorer calls this
    first and only POSTs to /agent/visualize/{question_id} if nothing is cached yet.
    """
    row = await pool.fetchrow("SELECT * FROM question_visualizations WHERE question_id=?", question_id)
    if not row:
        return {"available": False, "spec": None, "annotation": None, "reason": "not generated yet"}
    return _visualization_row_to_result(row)


@app.post("/agent/visualize/{question_id}")
async def agent_visualize(question_id: str, pool=Depends(get_pool)):
    """Phase 1 (Pure Mathematics Toolset) — generate, independently verify, and cache a
    constrained 3D visualization spec for one question. No org-scoped mirror: this only
    visualizes already-verified bank content, it doesn't create new content or consume an
    org's content-library quota, unlike /agent/generate and /org/agent/generate.
    """
    from app.agent.visualization_generator import generate_visualization

    row = await pool.fetchrow("SELECT id, topic, question, choices, correct, explanation FROM questions WHERE id=?", question_id)
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    cached = await pool.fetchrow("SELECT * FROM question_visualizations WHERE question_id=?", question_id)
    if cached:
        return _visualization_row_to_result(cached)

    question_row = {**dict(row), "choices": json.loads(row["choices"])}
    client = _get_router_client()
    result = await generate_visualization(client, question_row)

    status = "verified" if result["available"] else "unavailable"
    await pool.execute(
        "INSERT INTO question_visualizations (question_id, status, template, params_json, annotation, verification_log) "
        "VALUES (?,?,?,?,?,?)",
        question_id, status,
        result["spec"]["template"] if result["spec"] else None,
        json.dumps(result["spec"], ensure_ascii=False) if result["spec"] else None,
        result["annotation"], result["reason"],
    )
    return result


def _serialize_linalg_result(op: str, result):
    import sympy

    if isinstance(result, sympy.Matrix):
        return [[str(v) for v in result.row(r)] for r in range(result.shape[0])]
    if op == "rank":
        return int(result)
    if op == "eigen":
        return {str(k): v for k, v in result.items()}
    return str(result)


@app.post("/agent/linalg")
async def agent_linalg(body: dict):
    """Phase 6 (Pure Mathematics Toolset) — linear-algebra workspace. Stateless (no
    caching table — free-form matrix/prompt input isn't a stable cache key). Body is
    either a manually-entered {operation, matrices} spec (zero AI-router involvement,
    same as the mathlive calculator) or {prompt_text} (routes through draft_linalg_spec
    first). `eigen` is only reachable via the manual-spec path — never via prompt_text.
    """
    from app.agent.linalg_schema import validate_spec
    from app.agent.linalg_solver import LinAlgShapeError, draft_linalg_spec, solve_linalg, verify_linalg

    if "prompt_text" in body:
        client = _get_router_client()
        try:
            draft = await draft_linalg_spec(client, body["prompt_text"])
        except LinAlgShapeError as exc:
            return {"available": False, "result": None, "steps": None, "reason": str(exc)}
        if not draft.get("available"):
            return {"available": False, "result": None, "steps": None, "reason": draft.get("reason")}
        spec = draft["spec"]
    else:
        try:
            spec = validate_spec(body)
        except Exception as exc:
            return {"available": False, "result": None, "steps": None, "reason": str(exc)}

    try:
        derivation = solve_linalg(spec)
    except ValueError as exc:
        return {"available": False, "result": None, "steps": None, "reason": str(exc)}

    verification = verify_linalg(derivation)
    if not verification.ok:
        return {"available": False, "result": None, "steps": None, "reason": verification.reason}

    return {
        "available": True,
        "result": _serialize_linalg_result(spec.operation, derivation["result"]),
        "steps": derivation["steps"],
        "reason": None,
    }


@app.post("/agent/plot")
async def agent_plot(body: dict):
    """Phase 5 (Pure Mathematics Toolset) — Math Playground natural-language entry.
    Stateless (free-text input isn't a stable cache key). This is the ONLY path that
    calls the AI router for the playground — manually-typed curves render entirely
    client-side and never reach this route.
    """
    from app.agent.plot_generator import generate_plot

    prompt_text = body.get("prompt_text", "")
    client = _get_router_client()
    result = await generate_plot(client, prompt_text)
    return result


@app.post("/agent/simulate")
async def agent_simulate(body: dict):
    """Phase 7 (Pure Mathematics Toolset) — discrete probability simulator. Stateless,
    same manual-spec-or-prompt_text split as /agent/linalg. Only "dice" and "coin" are
    implemented; any other experiment abstains rather than fabricating a result.
    """
    from app.agent.stats_schema import validate_spec
    from app.agent.stats_simulator import (
        SimulationShapeError, _serialize_pmf, draft_simulation, run_simulation, verify_simulation,
    )

    if "prompt_text" in body:
        client = _get_router_client()
        try:
            draft = await draft_simulation(client, body["prompt_text"])
        except SimulationShapeError as exc:
            return {"available": False, "histogram": None, "pmf": None, "reason": str(exc)}
        if not draft.get("available"):
            return {"available": False, "histogram": None, "pmf": None, "reason": draft.get("reason")}
        spec = draft["spec"]
    else:
        try:
            spec = validate_spec(body)
        except Exception as exc:
            return {"available": False, "histogram": None, "pmf": None, "reason": str(exc)}

    try:
        result = run_simulation(spec)
    except NotImplementedError as exc:
        return {"available": False, "histogram": None, "pmf": None, "reason": str(exc)}

    verification = verify_simulation(result)
    if not verification["ok"]:
        return {"available": False, "histogram": None, "pmf": None, "reason": verification["reason"]}

    return {
        "available": True,
        "histogram": [int(v) for v in result["samples"]],
        "pmf": _serialize_pmf(result["pmf"]),
        "reason": None,
    }


@app.post("/cas/evaluate")
async def cas_evaluate(body: dict):
    """Phase 4 (Pure Mathematics Toolset) — authoritative "kiểm tra" check for the
    mathlive calculator. Plain sympy, zero AiRouterClient involvement: this endpoint
    exists purely to catch client-CAS (mathjs) edge cases with a second deterministic
    engine, not to add any AI translation step.
    """
    import sympy
    from sympy.parsing.sympy_parser import (
        convert_xor, implicit_multiplication_application, parse_expr, standard_transformations,
    )

    expr_str = body.get("expr", "")
    transformations = standard_transformations + (implicit_multiplication_application, convert_xor)
    try:
        parsed = parse_expr(expr_str, transformations=transformations)
        simplified = sympy.simplify(parsed)
    except (sympy.SympifyError, TypeError, SyntaxError, KeyError) as exc:
        return {"available": False, "reason": str(exc)}
    return {"available": True, "simplified": str(simplified)}


def _steps_row_to_result(row) -> dict:
    return {
        "available": row["status"] == "verified",
        "steps": json.loads(row["steps_json"]) if row["steps_json"] else None,
        "reason": None if row["status"] == "verified" else row["verification_log"],
    }


@app.get("/agent/solve/{question_id}")
async def agent_solve(question_id: str, pool=Depends(get_pool)):
    """Phase 3 (Pure Mathematics Toolset) — generate, independently verify, and cache a
    step-by-step solution for one question. Generates on cache-miss (unlike
    /agent/visualize's GET, which is cache-only) since a solution panel is opened
    on-demand from QuestionCard and there's no separate POST trigger for it.
    """
    from app.agent.step_solver import generate_solution

    row = await pool.fetchrow("SELECT id, topic, question, choices, correct, explanation FROM questions WHERE id=?", question_id)
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    cached = await pool.fetchrow("SELECT * FROM question_steps WHERE question_id=?", question_id)
    if cached:
        return _steps_row_to_result(cached)

    question_row = {**dict(row), "choices": json.loads(row["choices"])}
    client = _get_router_client()
    result = await generate_solution(client, question_row)

    status = "verified" if result["available"] else "unavailable"
    await pool.execute(
        "INSERT INTO question_steps (question_id, status, steps_json, verification_log) VALUES (?,?,?,?)",
        question_id, status,
        json.dumps(result["steps"], ensure_ascii=False) if result["steps"] else None,
        result["reason"],
    )
    return result


# --- Institutions Phase 1: org/tenant model, SSO, SCIM, RBAC, audit log -----------------

from app.org_auth import get_current_member, provision_or_update_member, record_audit, require_role  # noqa: E402


def _get_workos_client():
    from app.config import OrgAuthNotConfiguredError
    from app.org_auth import _get_workos_client as build_client

    try:
        return build_client(get_settings())
    except OrgAuthNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/auth/login")
async def auth_login():
    client = _get_workos_client()
    settings = get_settings()
    url = client.user_management.get_authorization_url(
        provider="authkit",
        redirect_uri=f"{settings.app_base_url.rstrip('/')}/auth/callback",
    )
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url, status_code=302)


@app.get("/auth/callback")
async def auth_callback(code: str, pool=Depends(get_pool)):
    from fastapi.responses import RedirectResponse

    client = _get_workos_client()
    settings = get_settings()
    try:
        auth_response = client.user_management.authenticate_with_code(code=code)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"WorkOS authentication failed: {exc}") from exc

    user = auth_response.user
    workos_org_id = getattr(auth_response, "organization_id", None)
    org_row = await pool.fetchrow("SELECT * FROM orgs WHERE workos_org_id=?", workos_org_id) if workos_org_id else None
    if not org_row:
        org_id = f"org_{uuid.uuid4().hex[:12]}"
        org_name = getattr(user, "email", "New Organization").split("@")[-1]
        await pool.execute(
            "INSERT INTO orgs (id, name, workos_org_id) VALUES (?,?,?)", org_id, org_name, workos_org_id,
        )
    else:
        org_id = org_row["id"]

    member = await provision_or_update_member(
        pool, org_id, email=user.email, workos_user_id=user.id, role="learner", source="sso_jit",
    )
    from app.org_auth import create_session

    token = await create_session(pool, member["id"])
    resp = RedirectResponse(f"{settings.app_base_url.rstrip('/')}/org", status_code=302)
    resp.set_cookie("org_session", token, httponly=True, secure=True, samesite="lax", max_age=7 * 24 * 3600)
    return resp


@app.post("/auth/logout")
async def auth_logout(request: Request, pool=Depends(get_pool)):
    from fastapi.responses import JSONResponse

    token = request.cookies.get("org_session")
    if token:
        await pool.execute("DELETE FROM org_sessions WHERE id=?", token)
    resp = JSONResponse({"status": "ok"})
    resp.delete_cookie("org_session")
    return resp


@app.get("/auth/me")
async def auth_me(current=Depends(get_current_member)):
    return current


@app.post("/webhooks/workos")
async def webhook_workos(request: Request, pool=Depends(get_pool)):
    settings = get_settings()
    if not settings.workos_webhook_secret:
        raise HTTPException(status_code=503, detail="workos_webhook_secret is not set")

    body = await request.json()
    event_type = body.get("event")
    data = body.get("data", {})

    if event_type in ("dsync.user.created", "dsync.user.updated"):
        org_row = await pool.fetchrow("SELECT id FROM orgs WHERE workos_org_id=?", data.get("directory_id"))
        if org_row:
            await provision_or_update_member(
                pool, org_row["id"],
                email=data.get("emails", [{}])[0].get("value") if data.get("emails") else data.get("username"),
                workos_user_id=data.get("id"), role="learner", source="scim",
            )
    elif event_type == "dsync.user.deleted":
        await pool.execute("UPDATE org_members SET status='deactivated' WHERE workos_user_id=?", data.get("id"))
    # dsync.group.* — log-and-ignore in Phase 1 (group->role mapping deferred).

    return {"received": True}


@app.get("/org/members")
async def org_list_members(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    rows = await pool.fetch("SELECT * FROM org_members WHERE org_id=? ORDER BY created_at", current["org"]["id"])
    return [dict(r) for r in rows]


@app.patch("/org/members/{member_id}")
async def org_patch_member(member_id: str, body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    org_id = current["org"]["id"]
    row = await pool.fetchrow("SELECT * FROM org_members WHERE id=? AND org_id=?", member_id, org_id)
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    if row["source"] == "scim":
        raise HTTPException(status_code=409, detail="SCIM-managed members can't be edited locally")

    if "role" in body:
        await pool.execute("UPDATE org_members SET role=?, updated_at=datetime('now') WHERE id=?", body["role"], member_id)
        await record_audit(pool, org_id, current["member"]["id"], "member.role_changed", target=member_id)
    if "status" in body:
        await pool.execute("UPDATE org_members SET status=?, updated_at=datetime('now') WHERE id=?", body["status"], member_id)
        await record_audit(pool, org_id, current["member"]["id"], "member.status_changed", target=member_id)
    return dict(await pool.fetchrow("SELECT * FROM org_members WHERE id=?", member_id))


@app.post("/org/members/invite")
async def org_invite_member(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    email = body.get("email")
    role = body.get("role", "learner")
    if not email:
        raise HTTPException(status_code=422, detail="email is required")
    org_id = current["org"]["id"]
    member_id = f"mem_{uuid.uuid4().hex[:12]}"
    try:
        await pool.execute(
            "INSERT INTO org_members (id, org_id, email, role, source) VALUES (?,?,?,?,?)",
            member_id, org_id, email, role, "manual",
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail=f"Could not invite member: {exc}") from exc
    await record_audit(pool, org_id, current["member"]["id"], "member.invited", target=member_id)
    return dict(await pool.fetchrow("SELECT * FROM org_members WHERE id=?", member_id))


@app.get("/org/audit-log")
async def org_audit_log(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    rows = await pool.fetch(
        "SELECT * FROM org_audit_log WHERE org_id=? ORDER BY created_at DESC", current["org"]["id"],
    )
    return {"local": [dict(r) for r in rows]}


@app.get("/org/settings")
async def org_get_settings(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT id, name FROM orgs WHERE id=?", current["org"]["id"])
    return dict(row)


@app.patch("/org/settings")
async def org_patch_settings(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    org_id = current["org"]["id"]
    if "name" in body:
        await pool.execute("UPDATE orgs SET name=? WHERE id=?", body["name"], org_id)
        await record_audit(pool, org_id, current["member"]["id"], "org.settings_changed", target="name")
    return dict(await pool.fetchrow("SELECT id, name FROM orgs WHERE id=?", org_id))


# --- Institutions Phase 2: branding, content library, attempts/analytics, ---------------
# --- integrations & webhooks, compliance ------------------------------------------------

from app import org_attempts, org_branding, org_compliance, org_content, org_integrations, webhooks  # noqa: E402


@app.get("/org/{org_id}/branding")
async def get_org_branding(org_id: str, pool=Depends(get_pool)):
    """Unauthenticated — the learner portal needs to theme itself before SSO completes."""
    branding = await org_branding.get_branding(pool, org_id)
    if not branding:
        raise HTTPException(status_code=404, detail="Org not found")
    return branding


@app.put("/org/settings/branding")
async def put_org_branding(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_branding.set_branding(pool, current["org"]["id"], body)


@app.get("/org/attempts/{attempt_id}/report.pdf")
async def get_attempt_report_pdf(attempt_id: str, current=Depends(get_current_member), pool=Depends(get_pool)):
    from app.org_reports import PdfReportsUnavailableError, render_attempt_pdf
    from fastapi.responses import Response

    attempt = await pool.fetchrow("SELECT * FROM org_exam_attempts WHERE id=? AND org_id=?", attempt_id, current["org"]["id"])
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    is_self = attempt["org_member_id"] == current["member"]["id"]
    is_admin = current["member"]["role"] in ("admin", "owner")
    if not (is_self or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this report")

    org = await pool.fetchrow("SELECT * FROM orgs WHERE id=?", current["org"]["id"])
    try:
        pdf_bytes = render_attempt_pdf(dict(org), current["member"]["email"], dict(attempt))
    except PdfReportsUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return Response(content=pdf_bytes, media_type="application/pdf")


@app.post("/org/content")
async def post_org_content(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_content.create_draft(pool, current["org"]["id"], current["member"]["id"], body)


@app.get("/org/content")
async def get_org_content(status: str | None = None, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_content.list_items(pool, current["org"]["id"], status)


@app.post("/org/content/{item_id}/submit")
async def submit_org_content(item_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    item = await org_content.submit_for_review(pool, current["org"]["id"], item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    return item


@app.post("/org/content/{item_id}/approve")
async def approve_org_content(item_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    item = await org_content.approve(pool, current["org"]["id"], item_id, current["member"]["id"])
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    return item


@app.post("/org/exams")
async def post_org_exam(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_content.create_org_exam(pool, current["org"]["id"], current["member"]["id"], body["title"], body.get("items", []))


@app.get("/org/exams/{exam_id}")
async def get_org_exam(exam_id: str, current=Depends(get_current_member), pool=Depends(get_pool)):
    exam = await org_content.get_org_exam(pool, current["org"]["id"], exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Org exam not found")
    return exam


@app.post("/org/exam-attempts")
async def post_org_attempt(body: dict, current=Depends(get_current_member), pool=Depends(get_pool)):
    attempt = await org_attempts.record_attempt(pool, current["org"]["id"], current["member"]["id"], body)
    await webhooks.enqueue_delivery(pool, current["org"]["id"], "attempt.completed", attempt)
    return attempt


@app.get("/org/analytics/cohorts/{cohort_id}")
async def get_cohort_analytics(cohort_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_attempts.cohort_analytics(pool, current["org"]["id"], cohort_id)


@app.get("/org/analytics/items")
async def get_item_analytics(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_attempts.item_analytics(pool, current["org"]["id"])


@app.get("/org/integrations/keys")
async def list_org_api_keys(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_integrations.list_api_keys(pool, current["org"]["id"])


@app.post("/org/integrations/keys")
async def create_org_api_key(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_integrations.create_api_key(pool, current["org"]["id"], body.get("label"), body.get("scopes", ""))


@app.get("/org/webhooks")
async def list_org_webhooks(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await webhooks.list_webhooks(pool, current["org"]["id"])


@app.post("/org/webhooks")
async def post_org_webhook(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await webhooks.create_webhook(pool, current["org"]["id"], body["url"], body["secret"], body.get("eventTypes", ""))


@app.get("/org/compliance/export")
async def get_compliance_export(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    return await org_compliance.export_evidence(pool, current["org"]["id"])


@app.get("/api/v1/org/roster")
async def api_get_roster(key=Depends(org_integrations.require_api_key), pool=Depends(get_pool)):
    rows = await pool.fetch("SELECT id, email, role, status FROM org_members WHERE org_id=?", key["org_id"])
    return [dict(r) for r in rows]


@app.get("/api/v1/org/scores")
async def api_get_scores(key=Depends(org_integrations.require_api_key), pool=Depends(get_pool)):
    rows = await pool.fetch(
        "SELECT id, org_member_id, exam_id, score, submitted_at FROM org_exam_attempts WHERE org_id=?", key["org_id"],
    )
    return [dict(r) for r in rows]


# --- Institutions Phase 3: tiered AI proctoring (scaffold, no vendor wired) -------------

from app.proctoring.tiers import requires_vendor, resolve_tier  # noqa: E402


@app.get("/org/proctoring-settings")
async def get_proctoring_settings(current=Depends(require_role("admin")), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT * FROM org_proctoring_settings WHERE org_id=?", current["org"]["id"])
    return dict(row) if row else {"org_id": current["org"]["id"], "tier_enabled": "none"}


@app.patch("/org/proctoring-settings")
async def patch_proctoring_settings(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    org_id = current["org"]["id"]
    tier = body.get("tierEnabled", "none")
    await pool.execute(
        "INSERT INTO org_proctoring_settings (org_id, tier_enabled) VALUES (?,?) "
        "ON CONFLICT(org_id) DO UPDATE SET tier_enabled=excluded.tier_enabled, updated_at=datetime('now')",
        org_id, tier,
    )
    await record_audit(pool, org_id, current["member"]["id"], "proctoring.settings_changed", target=tier)
    return {"org_id": org_id, "tier_enabled": tier}


@app.post("/proctoring/sessions")
async def post_proctoring_session(body: dict, current=Depends(get_current_member), pool=Depends(get_pool)):
    org_id = current["org"]["id"]
    settings_row = await pool.fetchrow("SELECT tier_enabled FROM org_proctoring_settings WHERE org_id=?", org_id)
    ceiling = settings_row["tier_enabled"] if settings_row else "none"
    tier = resolve_tier(body.get("stakesTier", "low"), ceiling)

    vendor_session_id = None
    if requires_vendor(tier):
        from app.config import ProctorNotConfiguredError
        from app.proctoring.vendor_client import ProctorVendorClient

        try:
            client = ProctorVendorClient(get_settings())
        except ProctorNotConfiguredError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        vendor_response = await client.create_vendor_session(body.get("examAttemptId", ""))
        vendor_session_id = vendor_response.get("id")

    session_id = f"psess_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO proctoring_sessions (id, exam_attempt_id, org_id, tier, vendor_session_id) VALUES (?,?,?,?,?)",
        session_id, body.get("examAttemptId"), org_id, tier, vendor_session_id,
    )
    return dict(await pool.fetchrow("SELECT * FROM proctoring_sessions WHERE id=?", session_id))


@app.post("/proctoring/sessions/{session_id}/events")
async def post_proctoring_event(session_id: str, body: dict, current=Depends(get_current_member), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT * FROM proctoring_sessions WHERE id=? AND org_id=?", session_id, current["org"]["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Proctoring session not found")
    flags = json.loads(row["flags_json"] or "[]")
    flags.append(body)
    new_status = "flagged" if body.get("severity") == "high" else row["status"]
    await pool.execute(
        "UPDATE proctoring_sessions SET flags_json=?, status=? WHERE id=?",
        json.dumps(flags, ensure_ascii=False), new_status, session_id,
    )
    return dict(await pool.fetchrow("SELECT * FROM proctoring_sessions WHERE id=?", session_id))


@app.get("/proctoring/sessions/{session_id}")
async def get_proctoring_session(session_id: str, current=Depends(get_current_member), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT * FROM proctoring_sessions WHERE id=? AND org_id=?", session_id, current["org"]["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Proctoring session not found")
    return {**dict(row), "flags_json": json.loads(row["flags_json"] or "[]")}


@app.get("/org/proctoring-sessions")
async def list_proctoring_sessions(status: str = "flagged", current=Depends(require_role("admin")), pool=Depends(get_pool)):
    rows = await pool.fetch(
        "SELECT * FROM proctoring_sessions WHERE org_id=? AND status=? ORDER BY created_at DESC", current["org"]["id"], status,
    )
    return [{**dict(r), "flags_json": json.loads(r["flags_json"] or "[]")} for r in rows]


@app.post("/org/proctoring-sessions/{session_id}/review")
async def review_proctoring_session(session_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT * FROM proctoring_sessions WHERE id=? AND org_id=?", session_id, current["org"]["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Proctoring session not found")
    await pool.execute("UPDATE proctoring_sessions SET status='reviewed' WHERE id=?", session_id)
    await record_audit(pool, current["org"]["id"], current["member"]["id"], "proctoring.session_reviewed", target=session_id)
    return {"id": session_id, "status": "reviewed"}


# --- Institutions Phase 3: org-scoped AI generation with a human-review gate ------------
# The existing /agent/generate above is untouched — still auto-promotes, platform-wide.
# Only this org-scoped path routes through an explicit approve step.

@app.post("/org/agent/generate")
async def org_agent_generate(body: dict, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    from app.agent.orchestrator import generate_batch_for_org

    topic = body.get("topic")
    difficulty = body.get("difficulty")
    count = min(int(body.get("count", 1)), 10)
    if not topic or not difficulty:
        raise HTTPException(status_code=422, detail="topic and difficulty are required")

    client = _get_router_client()
    results = await generate_batch_for_org(pool, client, topic, difficulty, count, current["org"]["id"], body.get("contentLibraryId"))
    return {"results": results}


@app.get("/org/pending")
async def org_pending(status: str | None = None, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    if status:
        rows = await pool.fetch("SELECT * FROM pending_questions WHERE org_id=? AND status=? ORDER BY created_at DESC", current["org"]["id"], status)
    else:
        rows = await pool.fetch("SELECT * FROM pending_questions WHERE org_id=? ORDER BY created_at DESC", current["org"]["id"])
    return [dict(r) for r in rows]


@app.post("/org/pending/{pending_id}/approve")
async def org_approve_pending(pending_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    from app.agent.orchestrator import approve_pending

    result = await approve_pending(pool, current["org"]["id"], pending_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pending item not found or not awaiting review")
    await record_audit(pool, current["org"]["id"], current["member"]["id"], "content.generated_question_approved", target=pending_id)
    return result


@app.post("/org/pending/{pending_id}/reject")
async def org_reject_pending(pending_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    row = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=? AND org_id=?", pending_id, current["org"]["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Pending item not found")
    await pool.execute("UPDATE pending_questions SET status='rejected' WHERE id=?", pending_id)
    return {"id": pending_id, "status": "rejected"}


# --- Institutions Phase 3: automated psychometric flagging ------------------------------

from app.psychometrics.aggregator import recompute_stats_for_question  # noqa: E402


@app.get("/questions/{question_id}/psychometrics")
async def get_question_psychometrics(question_id: str, pool=Depends(get_pool)):
    return await recompute_stats_for_question(pool, question_id)


@app.get("/org/psychometric-flags")
async def get_psychometric_flags(status: str = "open", current=Depends(require_role("admin")), pool=Depends(get_pool)):
    rows = await pool.fetch(
        "SELECT * FROM psychometric_flags WHERE org_id=? AND status=? ORDER BY flagged_at DESC", current["org"]["id"], status,
    )
    return [dict(r) for r in rows]


@app.post("/psychometric-flags/{flag_id}/dismiss")
async def dismiss_psychometric_flag(flag_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    await pool.execute("UPDATE psychometric_flags SET status='dismissed' WHERE id=? AND org_id=?", flag_id, current["org"]["id"])
    return {"id": flag_id, "status": "dismissed"}


# --- Institutions Phase 3: predictive cohort signals + plain-language narration ---------

from app.predictive.at_risk import compute_at_risk_signals, persist_signals  # noqa: E402


@app.get("/org/cohorts/{cohort_id}/at-risk")
async def get_cohort_at_risk(cohort_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    signals = await compute_at_risk_signals(pool, current["org"]["id"], cohort_id)
    await persist_signals(pool, signals)
    return signals


@app.post("/org/cohorts/{cohort_id}/report-narrative")
async def post_cohort_narrative(cohort_id: str, current=Depends(require_role("admin")), pool=Depends(get_pool)):
    from app.agent.narrator import narrate_cohort_summary

    cohort_stats = await org_attempts.cohort_analytics(pool, current["org"]["id"], cohort_id)
    at_risk_signals = await compute_at_risk_signals(pool, current["org"]["id"], cohort_id)
    client = _get_router_client()
    narrative = await narrate_cohort_summary(client, cohort_stats, at_risk_signals)
    return {"narrative": narrative}
