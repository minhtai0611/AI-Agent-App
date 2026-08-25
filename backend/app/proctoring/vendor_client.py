"""Institutions Phase 3 — proctoring vendor client (scaffold, no real vendor wired).

Modeled 1:1 on app.agent.router_client.AiRouterClient: unconfigured -> a typed error
the caller turns into a 503. No proctoring/identity vendor contract exists yet — this
is the seam a real integration (e.g. a Persona-style identity check plus a
Proctorio-style lockdown vendor) plugs into once one is chosen.
"""
import httpx

from app.config import ProctorNotConfiguredError, Settings


class ProctorVendorClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.proctor_api_key or not settings.proctor_base_url:
            raise ProctorNotConfiguredError(
                "proctor_api_key/proctor_base_url are not set — no proctoring vendor is configured yet"
            )
        self._base_url = settings.proctor_base_url.rstrip("/")
        self._api_key = settings.proctor_api_key

    async def create_vendor_session(self, exam_attempt_id: str) -> dict:
        """Placeholder call shape — replace with the chosen vendor's actual API once picked."""
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self._base_url}/sessions", headers=headers, json={"reference_id": exam_attempt_id},
            )
        resp.raise_for_status()
        return resp.json()
