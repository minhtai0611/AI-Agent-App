from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of CWD (e.g. npm run dev from repo root)
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    allowed_origins: str = "http://localhost:5173,https://exam-app-ey0.pages.dev"
    sqlite_path: str = "/data/app.db"

    # AI router — single ingress for backend model calls (see backend/app/agent/router_client.py).
    # Unset by default: the agent endpoints stay disabled until this is configured.
    ai_router_base_url: str | None = None
    ai_router_api_key: str | None = None
    ai_router_model: str = "default"
    # Comma-separated models to try in order if ai_router_model's provider is down
    # (401/403/500/502/503 from the router) — see AiRouterClient.complete_json.
    ai_router_fallback_models: str = ""

    # WorkOS — hosted SSO (SAML+OIDC via AuthKit), SCIM directory sync, audit logs.
    # Unset by default: the /auth/* and /org/* routes stay disabled (503) until configured.
    workos_api_key: str | None = None
    workos_client_id: str | None = None
    workos_cookie_password: str | None = None
    workos_webhook_secret: str | None = None
    app_base_url: str = "http://localhost:5173"

    # Institutions Phase 2 — outbound org webhook retry sweep (backend/app/webhooks.py).
    # Off by default: no scheduler/queue infra exists in this repo, so this is an
    # in-process asyncio loop, opt-in to avoid surprising background work in tests/dev.
    webhook_retry_enabled: bool = False

    # Institutions Phase 3 — tiered AI proctoring (scaffold). No real vendor chosen yet;
    # unset by default so /proctoring/* routes stay 503 until one is configured.
    proctor_api_key: str | None = None
    proctor_base_url: str | None = None

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


class OrgAuthNotConfiguredError(RuntimeError):
    """Raised when WORKOS_API_KEY/WORKOS_CLIENT_ID aren't set — org/SSO routes stay disabled until they are."""


class ProctorNotConfiguredError(RuntimeError):
    """Raised when PROCTOR_API_KEY/PROCTOR_BASE_URL aren't set — no vendor chosen yet."""


@lru_cache
def get_settings() -> Settings:
    return Settings()
