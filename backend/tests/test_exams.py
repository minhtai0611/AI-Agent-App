import os

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture(scope="module")
async def client(tmp_path_factory):
    db_path = str(tmp_path_factory.mktemp("db") / "test.db")
    os.environ["SQLITE_PATH"] = db_path
    from app.config import get_settings
    get_settings.cache_clear()

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    del os.environ["SQLITE_PATH"]
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_list_exams(client):
    resp = await client.get("/exams")
    assert resp.status_code == 200
    exams = resp.json()
    assert isinstance(exams, list)
    assert len(exams) > 0
    assert "id" in exams[0] and "title" in exams[0]


@pytest.mark.asyncio
async def test_get_exam_by_id(client):
    exams = (await client.get("/exams")).json()
    exam_id = exams[0]["id"]
    resp = await client.get(f"/exams/{exam_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == exam_id
    assert isinstance(body["questionIds"], list)


@pytest.mark.asyncio
async def test_get_exam_not_found(client):
    resp = await client.get("/exams/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_questions(client):
    resp = await client.get("/questions")
    assert resp.status_code == 200
    questions = resp.json()
    assert isinstance(questions, list)
    assert len(questions) > 0
    assert isinstance(questions[0]["choices"], list)


@pytest.mark.asyncio
async def test_batch_questions(client):
    questions = (await client.get("/questions")).json()
    ids = [q["id"] for q in questions[:3]]
    resp = await client.post("/questions/batch", json={"ids": ids})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == len(ids)


@pytest.mark.asyncio
async def test_batch_questions_empty(client):
    resp = await client.post("/questions/batch", json={"ids": []})
    assert resp.status_code == 200
    assert resp.json() == []
