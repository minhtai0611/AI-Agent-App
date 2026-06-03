"""Integration tests for exam AI endpoints (LLM calls are mocked)."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_pool
from app.dependencies import get_current_user, CurrentUser


# ── Dependency overrides ──────────────────────────────────────────────────────

def _mock_user():
    return CurrentUser(user_id=1, email="test@example.com")


def _mock_pool():
    pool = MagicMock()
    pool.fetchrow = AsyncMock(return_value={
        "subscription_tier": "student",  # passes tier gates for /study-plan
        "credits_balance": 100,
        "tos_accepted_at": "2024-01-01T00:00:00",
        "province": None,
    })
    pool.execute = AsyncMock(return_value="UPDATE 1")
    pool.fetch = AsyncMock(return_value=[])
    return pool


client = TestClient(app)


@pytest.fixture(autouse=True)
def _set_overrides():
    """Set mock overrides for each test; restore afterwards so other test
    modules that run later (e.g. test_auth_endpoint.py) start with a clean slate."""
    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_pool] = _mock_pool
    yield
    app.dependency_overrides.clear()
    app.dependency_overrides.update(saved)

MOCK_RESULT = {
    "score": 7.5,
    "accuracy": 0.75,
    "topicBreakdown": {
        "algebra": {"correct": 5, "total": 8, "accuracy": 0.625},
        "geometry": {"correct": 2, "total": 6, "accuracy": 0.333},
    },
    "examId": "test_exam",
    "timeSpent": 1800,
}

MOCK_QUESTION = {
    "id": "q_001",
    "topic": "algebra",
    "difficulty": "medium",
    "question": "Giải phương trình 2x + 3 = 7",
    "choices": ["x = 1", "x = 2", "x = 3", "x = 4"],
    "correct": 1,
}


def _mock_completion(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    choice.finish_reason = "stop"
    response = MagicMock()
    response.choices = [choice]
    return response


# ── /health ──────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ── /analyze ─────────────────────────────────────────────────────────────────

def test_analyze_happy_path():
    ai_json = json.dumps({
        "insights": "Điểm tốt, cần cải thiện hình học.",
        "weak_topics": ["geometry"],
        "recommendations": ["Ôn tập hình học", "Làm thêm đề thử"],
    })
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        r = client.post("/analyze", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    body = r.json()
    assert "insights" in body
    assert "weak_topics" in body
    assert "recommendations" in body


def test_analyze_bad_json_returns_502():
    with patch("app.agent.exam_analyzer.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion("not json at all")
        r = client.post("/analyze", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 502


# ── /hint ─────────────────────────────────────────────────────────────────────

def test_hint_happy_path():
    ai_json = json.dumps({"hint": "Hãy suy nghĩ về tính đối xứng.", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        r = client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    assert r.status_code == 200
    assert "hint" in r.json()


def test_hint_bad_json_returns_502():
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion("oops")
        r = client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    assert r.status_code == 502


# ── /study-plan ───────────────────────────────────────────────────────────────

def test_study_plan_happy_path():
    ai_json = json.dumps({
        "score_gap": "Cần cải thiện hình học.",
        "focus_areas": [
            {
                "topic": "geometry",
                "error_pattern": "Sai công thức diện tích.",
                "tasks": ["Ôn lại lý thuyết", "Làm 5 bài tập"],
                "checkpoint": {"target": 3, "description": "Trả lời đúng 3 câu liên tiếp"},
            }
        ],
        "retake_note": "Thử lại đề sau 2 tuần.",
    })
    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        r = client.post("/study-plan", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    body = r.json()
    assert "score_gap" in body
    assert "focus_areas" in body
    assert "retake_note" in body
    assert len(body["focus_areas"]) >= 1


def test_study_plan_llm_error_returns_default():
    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.side_effect = Exception("network error")
        r = client.post("/study-plan", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    body = r.json()
    # study_planner catches all exceptions and returns a built-in fallback
    assert "focus_areas" in body
    assert len(body["focus_areas"]) >= 1


# ── Rate limiter ──────────────────────────────────────────────────────────────

def test_rate_limit_triggered(monkeypatch):
    # Lower the IP limit to 2 so the 3rd request triggers 429.
    # The global _global_rate_limit_bypass fixture raises limits to 100,000 first;
    # monkeypatch overrides back down for this one test.
    monkeypatch.setattr("app.middleware._IP_LIMIT", 2)

    ai_json = json.dumps({"hint": "test", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        for _ in range(2):
            client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
        r = client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    assert r.status_code == 429
