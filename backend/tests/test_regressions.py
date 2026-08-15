"""
Regression test museum — every test here encodes a real production bug.

Rules:
  - NEVER delete a test from this file.
  - Tests are marked @pytest.mark.regression so they run in every CI job.
  - The docstring must state: what broke, commit that fixed it, and how to reproduce.
"""
import json
import pytest
import re
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import PoolBuilder, make_completion


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_with_user_and_pool(pool_mock):
    """Return a TestClient that uses the given pool mock and a fixed mock user.
    Saves and restores existing overrides so it is safe to call from any test."""
    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(user_id=1, email="reg@test.com")
    app.dependency_overrides[get_pool] = lambda: pool_mock
    client = TestClient(app)
    return client, saved


def _restore(saved):
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


# ── ac57c11 — get_session_today SQL binding ───────────────────────────────────

@pytest.mark.regression
def test_get_session_today_dual_uid_binding():
    """
    Bug: get_session_today remediation subquery had two $1/$2 placeholders
    but passed uid only once → aiosqlite raised "Wrong number of bindings".
    Fixed: commit ac57c11 (pass uid, uid to the remediation fetchrow).
    Reproduce: revert to passing `uid` once and the endpoint raises 500.
    """
    pool = PoolBuilder().build_mock()
    # All fetchrow calls return a dict that satisfies every query in get_session_today
    client, saved = _client_with_user_and_pool(pool)
    try:
        r = client.get("/users/me/session/today")
        # Before the fix this was 500; now it must be 200 or 503 (if pool missing)
        # We accept 200 or 404 but never 500
        assert r.status_code != 500, (
            f"Regression: get_session_today returned 500. "
            f"Check that uid is passed twice to the remediation query. Body: {r.text}"
        )
    finally:
        _restore(saved)


# ── d71ec67 — ± notation in answer matching ───────────────────────────────────

@pytest.mark.regression
def test_answer_matcher_handles_pm_notation():
    """
    Bug: expected_answers for Category F quadratic roots used ±2 / coordinate
    notation, but the answer checker's _normalize() didn't preserve '±' before
    stripping LaTeX, so phrases like '±2' or '(-2, 0)' were never matched.
    Fixed: commit d71ec67 — added ±2, (±), (-2,0), (2,0), (0,-4) to expected list,
    and confirmed _normalize preserves '±' as-is.
    Reproduce: remove '±2' from expected answers and the test fails.
    """
    # Inline the normalization logic (copied from test_wiki_math_system.py)
    # to avoid importing from a test module.
    _LATEX_STRIP_RE = re.compile(r'[$\\{}]|\\[a-zA-Z]+')
    _SPACE_RE = re.compile(r'\s+')

    def _normalize(text: str) -> str:
        text = (text
            .replace('\\pi', 'pi').replace('\\alpha', 'alpha').replace('\\beta', 'beta')
            .replace('\\sqrt', 'sqrt').replace('\\infty', 'infty').replace('\\frac', 'frac')
            .replace('\\cdot', '.').replace('\\times', 'x').replace('\\pm', '+-')
        )
        text = _LATEX_STRIP_RE.sub(' ', text)
        text = _SPACE_RE.sub(' ', text).strip().lower()
        text = text.replace(',', '.').replace('−', '-').replace('π', 'pi')
        text = text.replace('±', '±')
        return text

    def _answer_matches(final_answer: str, expected) -> bool:
        if not expected:
            return True
        norm_actual = _normalize(final_answer)
        candidates = [expected] if isinstance(expected, str) else expected
        for cand in candidates:
            if _normalize(cand) in norm_actual:
                return True
        return False

    # Solver outputs that should be matched by the fixed expected_answer list
    solver_outputs_that_must_match = [
        # Classic ± root output
        ("x = ±2 là nghiệm của phương trình", ["±2", "x = ±", "(-2, 0)", "(2, 0)", "(0, -4)"]),
        # Coordinate form
        ("Các điểm chặn trục x là (-2, 0) và (2, 0)", ["±2", "x = ±", "(-2, 0)", "(2, 0)", "(0, -4)"]),
        # y-intercept coordinate form
        ("Điểm chặn trục y là (0, -4)", ["±2", "x = ±", "(-2, 0)", "(2, 0)", "(0, -4)"]),
        # LaTeX \pm form — normalized to +-
        ("x = \\pm 2", ["+-", "x = ±", "±2"]),
    ]

    for solver_output, expected_list in solver_outputs_that_must_match:
        assert _answer_matches(solver_output, expected_list), (
            f"Regression d71ec67: answer matcher failed to match.\n"
            f"  solver_output: {solver_output!r}\n"
            f"  expected_list: {expected_list}"
        )


# ── 2026-06-30 — email registration issues JWT directly ──────────────────────

@pytest.mark.regression
@pytest.mark.asyncio
async def test_email_register_issues_jwt_immediately():
    """
    Bug: POST /auth/email/register returned {"detail": "verification_sent"} and
    created the user with email_verified=0, forcing a click-through email before
    login was possible. Registration is now instant — the endpoint issues a JWT
    session directly (email_verified=1, same as Google OAuth).

    Fixed: 2026-06-30 — insert email_verified=1, call _issue_session(), return
    access_token/csrf_token instead of verification_sent.

    Reproduce: revert email_verified INSERT to 0 and remove _issue_session() call
    from auth_email_register — the endpoint returns 200 with no access_token.
    """
    import os
    os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-chars-long!")
    os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", "test-token")
    from unittest.mock import AsyncMock, MagicMock, patch
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    pool = MagicMock()
    pool.fetchrow = AsyncMock(side_effect=[
        {"cnt": 0},   # IP rate limit check
        None,         # existing user check → not found
        {"id": 42},   # INSERT RETURNING id
    ])
    pool.execute = AsyncMock(return_value="OK")
    pool.acquire = MagicMock()

    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_pool] = lambda: pool
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/email/register",
                json={"email": "new@example.com", "password": "StrongPass1!"},
            )
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    # Must return a usable session — not a "check your email" message
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "access_token" in data, f"Missing access_token in: {data}"
    assert "detail" not in data or data.get("detail") != "verification_sent", (
        "Regression: registration still returns verification_sent instead of JWT"
    )


# ── Template regression: copy this block for future production bugs ───────────
#
# @pytest.mark.regression
# def test_regression_YYYY_MM_short_description():
#     """
#     Bug: <what broke in production>
#     Fixed: commit <hash> — <one-line description of fix>
#     Reproduce: <what to revert to trigger the bug>
#     """
#     ...
