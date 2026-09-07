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

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
