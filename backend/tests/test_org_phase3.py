import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.agent import orchestrator
from app.main import app
from app.org_auth import create_session
from app.proctoring import tiers
from app.psychometrics import stats


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    os.environ["WORKOS_API_KEY"] = ""
    os.environ["WORKOS_CLIENT_ID"] = ""
    os.environ["AI_ROUTER_BASE_URL"] = ""
    os.environ["PROCTOR_API_KEY"] = ""
    os.environ["PROCTOR_BASE_URL"] = ""
    from app.config import get_settings
    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    for var in ("SQLITE_PATH", "WORKOS_API_KEY", "WORKOS_CLIENT_ID", "AI_ROUTER_BASE_URL", "PROCTOR_API_KEY", "PROCTOR_BASE_URL"):
        del os.environ[var]
    get_settings.cache_clear()


async def _seed_org_with_admin(pool, org_id, admin_email):
    await pool.execute("INSERT OR IGNORE INTO orgs (id, name) VALUES (?,?)", org_id, f"{org_id} name")
    admin_id = f"mem_{org_id}_admin"
    await pool.execute(
        "INSERT OR IGNORE INTO org_members (id, org_id, email, role, source) VALUES (?,?,?,?,?)",
        admin_id, org_id, admin_email, "admin", "manual",
    )
    token = await create_session(pool, admin_id)
    return admin_id, {"org_session": token}


def _good_draft(claimed_index=0, question_tex="If $2x + 3 = 11$, what is $4x + 6$?"):
    return {
        "topic": "algebra", "difficulty": "easy",
        "question_tex": question_tex,
        "variables": ["x"], "given_equations": ["2*x + 3 - 11"], "target_expression": "4*x + 6",
        "choice_expressions": ["22", "8", "14", "16"], "claimed_correct_index": claimed_index,
        "explanation_tex": "4x + 6 = 2(2x+3) = 2*11 = 22",
    }


class _FakeRouterClient:
    def __init__(self, drafts):
        self._drafts = list(drafts)

    async def complete_json(self, system_prompt, user_prompt):
        return self._drafts.pop(0)


# --- Most important regression: org-scoped generation is gated, platform path isn't ----

@pytest.mark.asyncio
async def test_org_scoped_generation_requires_approval_before_going_live(client):
    pool = app.state.pool
    question_tex = "test_org_scoped_generation_requires_approval_before_going_live unique stem $2x+3=11$?"
    fake_client = _FakeRouterClient([_good_draft(claimed_index=0, question_tex=question_tex)])
    result = await orchestrator.generate_one_for_org(pool, fake_client, "algebra", "easy", "org_gate")

    assert result["status"] == "verified_pending_review"
    pending = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=?", result["id"])
    assert pending["status"] == "verified_pending_review"
    assert pending["org_id"] == "org_gate"

    # Not yet in the live bank — this is the behavior change from unconditional auto-promote.
    before = await pool.fetchval("SELECT COUNT(*) FROM questions WHERE question=?", question_tex)
    assert before == 0

    approved = await orchestrator.approve_pending(pool, "org_gate", result["id"])
    assert approved["status"] == "approved"
    row = await pool.fetchrow("SELECT * FROM questions WHERE id=?", approved["question_id"])
    assert row is not None
    assert row["origin"] == "agent"


@pytest.mark.asyncio
async def test_platform_wide_generate_still_auto_promotes_unchanged(client):
    """Existing behavior must not regress: /agent/generate still auto-promotes."""
    pool = app.state.pool
    question_tex = "test_platform_wide_generate_still_auto_promotes_unchanged unique stem $2x+3=11$?"
    fake_client = _FakeRouterClient([_good_draft(claimed_index=0, question_tex=question_tex)])
    result = await orchestrator.generate_one(pool, fake_client, "algebra", "easy")
    assert result["status"] == "verified"
    row = await pool.fetchrow("SELECT * FROM questions WHERE id=?", result["question_id"])
    assert row is not None


@pytest.mark.asyncio
async def test_org_agent_generate_route_and_approval_flow(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_gen", "admin@gen.test")

    import app.agent.orchestrator as orch_module
    import app.main as main_module

    async def fake_batch(pool_, client_, topic, difficulty, count, org_id, content_library_id=None):
        return [{"id": "pend_fake1", "status": "verified_pending_review"}]

    real = orch_module.generate_batch_for_org
    orch_module.generate_batch_for_org = fake_batch
    try:
        # Router still unconfigured — the route must 503 before even reaching our fake,
        # since _get_router_client() is called first (matches /agent/generate's contract).
        resp = await client.post("/org/agent/generate", json={"topic": "algebra", "difficulty": "easy"}, cookies=cookies)
        assert resp.status_code == 503
    finally:
        orch_module.generate_batch_for_org = real


@pytest.mark.asyncio
async def test_org_reject_pending(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_rej", "admin@rej.test")
    bad_draft = _good_draft(claimed_index=1)  # wrong on every attempt -> exhausts to 'rejected'
    fake_client = _FakeRouterClient([bad_draft, bad_draft, bad_draft])
    result = await orchestrator.generate_one_for_org(pool, fake_client, "algebra", "easy", "org_rej")
    assert result["status"] == "rejected"

    # Reject is idempotent — re-rejecting an already-rejected item is a 200, not an error.
    resp = await client.post(f"/org/pending/{result['id']}/reject", cookies=cookies)
    assert resp.status_code == 200
    pending = await pool.fetchrow("SELECT * FROM pending_questions WHERE id=?", result["id"])
    assert pending["status"] == "rejected"

    # A different org can't reject items that aren't theirs.
    _, other_cookies = await _seed_org_with_admin(pool, "org_rej_other", "admin@rejother.test")
    resp = await client.post(f"/org/pending/{result['id']}/reject", cookies=other_cookies)
    assert resp.status_code == 404


# --- Proctoring tier policy: pure logic, no vendor ---------------------------------------

def test_tier_policy_low_stakes_maps_to_ai_review():
    assert tiers.resolve_tier("low", "human_escalation") == "ai_review"


def test_tier_policy_org_ceiling_caps_below_exam_stakes():
    assert tiers.resolve_tier("certification", "ai_review") == "ai_review"


def test_tier_policy_none_when_org_opted_out():
    assert tiers.resolve_tier("certification", "none") == "none"


@pytest.mark.asyncio
async def test_proctoring_session_503_when_vendor_required_but_unconfigured(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_proc", "admin@proc.test")
    await client.patch("/org/proctoring-settings", json={"tierEnabled": "human_escalation"}, cookies=cookies)

    resp = await client.post("/proctoring/sessions", json={"examAttemptId": "att1", "stakesTier": "certification"}, cookies=cookies)
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_proctoring_session_ai_review_needs_no_vendor(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_proc2", "admin@proc2.test")
    await client.patch("/org/proctoring-settings", json={"tierEnabled": "ai_review"}, cookies=cookies)

    resp = await client.post("/proctoring/sessions", json={"examAttemptId": "att2", "stakesTier": "low"}, cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["tier"] == "ai_review"


@pytest.mark.asyncio
async def test_proctoring_session_flagged_by_high_severity_event_and_reviewable(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_proc3", "admin@proc3.test")
    await client.patch("/org/proctoring-settings", json={"tierEnabled": "ai_review"}, cookies=cookies)

    created = await client.post("/proctoring/sessions", json={"examAttemptId": "att3", "stakesTier": "low"}, cookies=cookies)
    session_id = created.json()["id"]

    # Not flagged until a high-severity event lands.
    resp = await client.get("/org/proctoring-sessions?status=flagged", cookies=cookies)
    assert resp.json() == []

    await client.post(f"/proctoring/sessions/{session_id}/events", json={"type": "tab_switch", "severity": "high"}, cookies=cookies)
    resp = await client.get("/org/proctoring-sessions?status=flagged", cookies=cookies)
    ids = [row["id"] for row in resp.json()]
    assert session_id in ids

    resp = await client.post(f"/org/proctoring-sessions/{session_id}/review", cookies=cookies)
    assert resp.status_code == 200
    resp = await client.get("/org/proctoring-sessions?status=flagged", cookies=cookies)
    assert session_id not in [row["id"] for row in resp.json()]

    # Cross-org isolation: another org's admin can't see or review this session.
    _, other_cookies = await _seed_org_with_admin(pool, "org_proc3_other", "admin@proc3other.test")
    resp = await client.post(f"/org/proctoring-sessions/{session_id}/review", cookies=other_cookies)
    assert resp.status_code == 404


# --- Psychometrics: pure stats functions -------------------------------------------------

def test_difficulty_index_basic():
    assert stats.difficulty_index(7, 10) == 0.7


def test_difficulty_index_zero_attempts():
    assert stats.difficulty_index(0, 0) is None


def test_discrimination_index_positive_when_high_scorers_do_better():
    assert stats.discrimination_index(0.9, 0.3) == pytest.approx(0.6)


def test_flag_drift_detects_large_shift():
    assert stats.flag_drift(0.8, 0.5) is True
    assert stats.flag_drift(0.8, 0.75) is False


@pytest.mark.asyncio
async def test_psychometric_flags_endpoint_empty_by_default(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_psy", "admin@psy.test")
    resp = await client.get("/org/psychometric-flags", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json() == []


# --- Predictive signals + narration ------------------------------------------------------

@pytest.mark.asyncio
async def test_at_risk_endpoint_returns_list(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_risk", "admin@risk.test")
    await pool.execute("INSERT INTO org_cohorts (id, org_id, name) VALUES (?,?,?)", "cohort_risk", "org_risk", "Cohort")
    resp = await client.get("/org/cohorts/cohort_risk/at-risk", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_narrative_503_when_router_unconfigured(client):
    pool = app.state.pool
    admin_id, cookies = await _seed_org_with_admin(pool, "org_narr", "admin@narr.test")
    await pool.execute("INSERT INTO org_cohorts (id, org_id, name) VALUES (?,?,?)", "cohort_narr", "org_narr", "Cohort")
    resp = await client.post("/org/cohorts/cohort_narr/report-narrative", cookies=cookies)
    assert resp.status_code == 503
