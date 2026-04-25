"""Integration tests for exam AI endpoints (LLM calls are mocked)."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

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


# ── /tutor ────────────────────────────────────────────────────────────────────

def test_tutor_happy_path():
    with patch("app.agent.exam_tutor.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion("Chào em! Hôm nay chúng ta ôn gì?")
        r = client.post("/tutor", json={
            "messages": [],
            "exam_context": {"examId": "test", "topicBreakdown": {}, "weakTopics": []},
        })
    assert r.status_code == 200
    body = r.json()
    assert "reply" in body
    assert "messages" in body


# ── /study-plan ───────────────────────────────────────────────────────────────

def test_study_plan_happy_path():
    ai_json = json.dumps({
        "plan": "## Kế hoạch\n- Ôn tập đại số",
        "weekly_schedule": [
            {"week": 1, "focus": "Đại số", "tasks": ["Bài tập 1"]},
        ],
    })
    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        r = client.post("/study-plan", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    body = r.json()
    assert "plan" in body
    assert "weekly_schedule" in body
    assert len(body["weekly_schedule"]) >= 1


def test_study_plan_llm_error_returns_default():
    with patch("app.agent.study_planner.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.side_effect = Exception("network error")
        r = client.post("/study-plan", json={"result": MOCK_RESULT, "history": []})
    assert r.status_code == 200
    body = r.json()
    assert len(body["weekly_schedule"]) == 4


# ── Rate limiter ──────────────────────────────────────────────────────────────

def test_rate_limit_triggered(monkeypatch):
    from app.middleware import RateLimitMiddleware, _LIMIT
    monkeypatch.setattr("app.middleware._LIMIT", 2)

    ai_json = json.dumps({"hint": "test", "difficulty_note": ""})
    with patch("app.agent.hint_generator.call_with_retry", new_callable=AsyncMock) as mock_retry:
        mock_retry.return_value = _mock_completion(ai_json)
        for _ in range(2):
            client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
        r = client.post("/hint", json={"question": MOCK_QUESTION, "attempt_count": 1})
    assert r.status_code == 429
