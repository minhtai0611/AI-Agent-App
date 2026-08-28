from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.agent.router_client import AiRouterClient, RouterRequestError
from app.config import Settings


def _settings(**overrides):
    defaults = dict(
        ai_router_base_url="https://ai-router.example",
        ai_router_api_key="sk-test",
        ai_router_model="primary-model",
        ai_router_fallback_models="fallback-a,fallback-b",
    )
    return Settings(**{**defaults, **overrides})


def _resp(status_code, body=None, text=""):
    r = httpx.Response(status_code, json=body, text=text if body is None else None)
    return r


@pytest.mark.asyncio
async def test_uses_primary_model_when_it_succeeds():
    ok = _resp(200, {"choices": [{"message": {"content": '{"ok": true}'}}]})
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=ok)) as mock_post:
        client = AiRouterClient(_settings())
        result = await client.complete_json("sys", "user")
    assert result == {"ok": True}
    assert mock_post.call_count == 1
    assert mock_post.call_args.kwargs["json"]["model"] == "primary-model"


@pytest.mark.asyncio
async def test_falls_back_when_primary_provider_is_down():
    down = _resp(401, text="OAuth expired")
    ok = _resp(200, {"choices": [{"message": {"content": '{"ok": true}'}}]})
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=[down, ok])) as mock_post:
        client = AiRouterClient(_settings())
        result = await client.complete_json("sys", "user")
    assert result == {"ok": True}
    assert mock_post.call_count == 2
    assert mock_post.call_args_list[0].kwargs["json"]["model"] == "primary-model"
    assert mock_post.call_args_list[1].kwargs["json"]["model"] == "fallback-a"


@pytest.mark.asyncio
async def test_tries_every_fallback_before_giving_up():
    down = _resp(503, text="auth_unavailable")
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=down)) as mock_post:
        client = AiRouterClient(_settings())
        with pytest.raises(RouterRequestError):
            await client.complete_json("sys", "user")
    assert mock_post.call_count == 3  # primary + fallback-a + fallback-b


@pytest.mark.asyncio
async def test_does_not_fall_back_on_a_bad_request():
    bad = _resp(422, text="invalid request")
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=bad)) as mock_post:
        client = AiRouterClient(_settings())
        with pytest.raises(RouterRequestError):
            await client.complete_json("sys", "user")
    assert mock_post.call_count == 1  # no point retrying other models on a bad request


@pytest.mark.asyncio
async def test_does_not_fall_back_on_unparseable_json():
    malformed = _resp(200, {"choices": [{"message": {"content": "not json"}}]})
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=malformed)) as mock_post:
        client = AiRouterClient(_settings())
        with pytest.raises(RouterRequestError):
            await client.complete_json("sys", "user")
    assert mock_post.call_count == 1  # a model-quality issue, not a provider outage


@pytest.mark.asyncio
async def test_retries_the_same_model_on_a_transient_transport_error():
    ok = _resp(200, {"choices": [{"message": {"content": '{"ok": true}'}}]})
    with patch(
        "httpx.AsyncClient.post", new=AsyncMock(side_effect=[httpx.ConnectTimeout("timed out"), ok])
    ) as mock_post:
        client = AiRouterClient(_settings())
        result = await client.complete_json("sys", "user")
    assert result == {"ok": True}
    assert mock_post.call_count == 2
    # both attempts hit the same (primary) model — a transport retry, not a fallback
    assert mock_post.call_args_list[0].kwargs["json"]["model"] == "primary-model"
    assert mock_post.call_args_list[1].kwargs["json"]["model"] == "primary-model"


@pytest.mark.asyncio
async def test_falls_back_to_next_model_after_transport_retries_are_exhausted():
    ok = _resp(200, {"choices": [{"message": {"content": '{"ok": true}'}}]})
    with patch(
        "httpx.AsyncClient.post",
        new=AsyncMock(side_effect=[
            httpx.ConnectTimeout("timed out"), httpx.ConnectTimeout("timed out"), httpx.ConnectTimeout("timed out"),
            ok,
        ]),
    ) as mock_post:
        client = AiRouterClient(_settings())
        result = await client.complete_json("sys", "user")
    assert result == {"ok": True}
    assert mock_post.call_count == 4  # 3 attempts on primary-model, then 1 on fallback-a
    assert mock_post.call_args_list[0].kwargs["json"]["model"] == "primary-model"
    assert mock_post.call_args_list[2].kwargs["json"]["model"] == "primary-model"
    assert mock_post.call_args_list[3].kwargs["json"]["model"] == "fallback-a"
