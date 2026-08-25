"""Client for ai-router.locdo.tech — the single ingress for backend model calls.

Confirmed contract (see /keys on the router dashboard): OpenAI-compatible chat
completions live at `/v2/chat/completions` (not the more common `/v1/chat/completions`
path other self-hosted routers use); an Anthropic-native `/v1/messages` endpoint also
exists for tool-use-heavy agent work. This client uses the v2 chat-completions shape to
match generator.py's json_object response format. If the contract changes again, only
this file needs to change — every other agent module talks to `AiRouterClient`, never to
an HTTP endpoint directly.
"""
import json
import logging

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

# Status codes that mean "this model's provider/session is down", not "the request was
# bad" — worth retrying against a fallback model. Everything we've actually seen from
# ai-router.locdo.tech during its current outage falls in here: 401 (Claude OAuth expired),
# 403 (Gemini license), 502 (broken model alias upstream), 503 (auth_unavailable).
_PROVIDER_DOWN_STATUSES = {401, 403, 500, 502, 503}


class RouterNotConfiguredError(RuntimeError):
    """Raised when AI_ROUTER_BASE_URL isn't set — agent endpoints stay disabled until it is."""


class RouterRequestError(RuntimeError):
    """Raised when every model (primary + fallbacks) failed, or the body was unparseable."""


class _ProviderDownError(RuntimeError):
    """Internal: this model's provider looks down — try the next one in the fallback chain."""


class AiRouterClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.ai_router_base_url:
            raise RouterNotConfiguredError(
                "ai_router_base_url is not set — configure it before calling the agent endpoints"
            )
        self._base_url = settings.ai_router_base_url.rstrip("/")
        self._api_key = settings.ai_router_api_key
        self._model = settings.ai_router_model
        self._fallback_models = [
            m.strip() for m in (settings.ai_router_fallback_models or "").split(",") if m.strip()
        ]

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Send a chat-completions request and return the parsed JSON object the model returned.

        Tries `ai_router_model` first, then each of `ai_router_fallback_models` in order if a
        provider-down status comes back — so one dead provider on the router doesn't take the
        whole feature down when another still works. Raises RouterRequestError only once every
        model in the chain has failed, or on a non-provider error (bad request, unparseable JSON).
        """
        last_exc: Exception | None = None
        for model in (self._model, *self._fallback_models):
            try:
                return await self._request_one(model, system_prompt, user_prompt)
            except _ProviderDownError as exc:
                logger.warning("ai-router model %s unavailable, trying next: %s", model, exc)
                last_exc = exc
                continue
        raise RouterRequestError(f"all models exhausted ({self._model}, {self._fallback_models}): {last_exc}")

    async def _request_one(self, model: str, system_prompt: str, user_prompt: str) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(
                    f"{self._base_url}/v2/chat/completions", headers=headers, json=body
                )
            except httpx.HTTPError as exc:
                raise _ProviderDownError(f"ai-router request failed: {exc}") from exc

        if resp.status_code in _PROVIDER_DOWN_STATUSES:
            raise _ProviderDownError(f"ai-router returned {resp.status_code}: {resp.text[:300]}")
        if resp.status_code >= 400:
            raise RouterRequestError(f"ai-router returned {resp.status_code}: {resp.text[:300]}")

        try:
            payload = resp.json()
            content = payload["choices"][0]["message"]["content"]
            return json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
            raise RouterRequestError(f"ai-router response wasn't parseable JSON: {exc}") from exc
