"""
Property-based tests using Hypothesis @given.

These tests describe INVARIANTS — properties that must hold for ALL valid inputs,
not just the hand-picked examples in YAML catalogs.

Hypothesis generates hundreds of inputs automatically, including edge cases
(score=0.0, score=10.0, NaN-adjacent floats, unusual province strings) that
human test authors would never think to write.

The key difference from test_llm_oracle.py:
  - test_llm_oracle.py: specific examples from YAML catalogs
  - test_property_based.py: universal invariants via Hypothesis strategies

Run:
    PYTHONPATH=backend pytest backend/tests/test_property_based.py -v
    PYTHONPATH=backend pytest backend/tests/test_property_based.py --hypothesis-seed=0
"""
import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser
from tests.builders import PoolBuilder, MOCK_QUESTION, make_completion

# ── Vietnamese provinces — real values the app handles ───────────────────────
VN_PROVINCES = [
    "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
    "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
    "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước",
    "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông",
    "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang",
    "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Hòa Bình",
    "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
    "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
    "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên",
    "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị",
    "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
    "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
    "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
]

# ── Shared setup ──────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _active_user():
    saved = dict(app.dependency_overrides)
    pool = PoolBuilder().with_tier("student").with_credits(100).build_mock()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=1, email="property@test.com"
    )
    app.dependency_overrides[get_pool] = lambda: pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)


def _client():
    return TestClient(app, raise_server_exceptions=False)


# ── Strategies ────────────────────────────────────────────────────────────────

exam_scores     = st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
provinces       = st.sampled_from(VN_PROVINCES)
grades          = st.sampled_from(["10", "11", "12"])
attempt_counts  = st.integers(min_value=1, max_value=20)
credit_amounts  = st.integers(min_value=0, max_value=500)


def _mock_result(score: float) -> dict:
    return {
        "score": score,
        "accuracy": min(1.0, max(0.0, score / 10.0)),
        "topicBreakdown": {
            "algebra": {"correct": 3, "total": 5, "accuracy": 0.6},
        },
        "examId": "prop_test",
        "timeSpent": 1800,
    }


# ── Analyze invariants ────────────────────────────────────────────────────────

@pytest.mark.property_based
@settings(max_examples=40, deadline=5000)
@given(score=exam_scores, province=provinces)
def test_analyze_always_returns_three_required_fields(score, province):
    """
    Invariant: /analyze always returns insights, weak_topics, recommendations
    regardless of score (0–10) or province (any of 63 VN provinces).
    """
    ai_json = json.dumps({
        "insights": "Test insight.",
        "weak_topics": ["algebra"] if score < 8.0 else [],
        "recommendations": ["Study more."] if score < 8.0 else ["Keep going."],
    })
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post(
            "/analyze",
            json={"result": _mock_result(score), "history": [], "user_profile": {"province": province}},
        )
    assert r.status_code == 200, f"score={score}, province={province}: {r.status_code} {r.text[:200]}"
    body = r.json()
    for field in ("insights", "weak_topics", "recommendations"):
        assert field in body, f"Missing field '{field}' for score={score}"


@pytest.mark.property_based
@settings(max_examples=40, deadline=5000)
@given(score=exam_scores)
def test_analyze_response_types_are_stable(score):
    """
    Invariant: weak_topics is always a list, insights is always a str.
    Type regressions (string instead of list) must be caught.
    """
    ai_json = json.dumps({
        "insights": f"Score was {score:.1f}.",
        "weak_topics": ["calculus"] if score < 5.0 else [],
        "recommendations": [],
    })
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post("/analyze", json={"result": _mock_result(score), "history": []})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["insights"], str), "insights must be str"
    assert isinstance(body["weak_topics"], list), "weak_topics must be list"
    assert isinstance(body["recommendations"], list), "recommendations must be list"


# ── Hint invariants ───────────────────────────────────────────────────────────

@pytest.mark.property_based
@settings(max_examples=40, deadline=5000)
@given(attempt_count=attempt_counts)
def test_hint_attempt_count_never_changes_status(attempt_count):
    """
    Invariant: attempt_count (1–20) must never affect the HTTP status for
    an active user. The hint endpoint has no gate on attempt count.
    """
    ai_json = json.dumps({"hint": f"Attempt {attempt_count} hint.", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": attempt_count})
    assert r.status_code == 200, (
        f"attempt_count={attempt_count} should never affect status for active user, "
        f"got {r.status_code}: {r.text[:200]}"
    )


@pytest.mark.property_based
@settings(max_examples=30, deadline=5000)
@given(attempt_count=attempt_counts)
def test_hint_response_always_has_hint_field(attempt_count):
    """Invariant: the 'hint' field is always present in a 200 response."""
    ai_json = json.dumps({"hint": "Always present.", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
               return_value=make_completion(ai_json)):
        r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": attempt_count})
    assert r.status_code == 200
    assert "hint" in r.json(), "'hint' must always be in response body"
    assert isinstance(r.json()["hint"], str), "'hint' must be a string"


# ── Credit boundary invariants ────────────────────────────────────────────────

@pytest.mark.property_based
@settings(max_examples=40, deadline=5000)
@given(credits=credit_amounts)
def test_hint_credit_boundary_property(credits):
    """
    Invariant (boundary): credits >= 1 → 200; credits == 0 → 402.
    This must hold for ANY non-negative credit amount.
    """
    saved = dict(app.dependency_overrides)
    builder = PoolBuilder().with_tier("basic").with_credits(credits)
    builder.credits_update_succeeds = credits >= 1
    pool = builder.build_mock()
    app.dependency_overrides[get_pool] = lambda: pool

    ai_json = json.dumps({"hint": "ok", "difficulty_note": ""})
    try:
        with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock,
                   return_value=make_completion(ai_json)):
            r = _client().post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    if credits >= 1:
        assert r.status_code == 200, (
            f"credits={credits} (≥1, cost=1): expected 200, got {r.status_code}"
        )
    else:
        assert r.status_code == 402, (
            f"credits={credits} (0): expected 402, got {r.status_code}: {r.text}"
        )


@pytest.mark.property_based
@settings(max_examples=40, deadline=5000)
@given(credits=credit_amounts)
def test_analyze_credit_boundary_property_basic_tier(credits):
    """
    Invariant (boundary, basic tier): credits >= 3 → 200; credits < 3 → 402.
    Only basic tier goes through the credit gate for /analyze.
    """
    saved = dict(app.dependency_overrides)
    builder = PoolBuilder().with_tier("basic").with_credits(credits)
    builder.credits_update_succeeds = credits >= 3
    pool = builder.build_mock()
    app.dependency_overrides[get_pool] = lambda: pool

    ai_json = json.dumps({"insights": "ok", "weak_topics": [], "recommendations": []})
    try:
        with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock,
                   return_value=make_completion(ai_json)):
            r = _client().post("/analyze", json={"result": _mock_result(7.0), "history": []})
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(saved)

    if credits >= 3:
        assert r.status_code == 200, (
            f"credits={credits} (≥3, cost=3): expected 200, got {r.status_code}"
        )
    else:
        assert r.status_code == 402, (
            f"credits={credits} (<3): expected 402, got {r.status_code}: {r.text}"
        )
