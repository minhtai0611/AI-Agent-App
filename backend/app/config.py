from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of CWD (e.g. npm run dev from repo root)
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    anthropic_base_url: str = "https://ai-router.locdo.tech"
    anthropic_auth_token: str

    anthropic_default_opus_model: str = "claude-opus-4.6"
    anthropic_default_sonnet_model: str = "claude-sonnet-4.6"
    anthropic_default_haiku_model: str = "claude-haiku-4.5"
    anthropic_default_hint_model: str = "claude-haiku-4.5"
    # Model to retry against when the router reports the primary model's provider
    # is unavailable (401 expired OAuth session, 503 auth_unavailable — router-side
    # outage, not our credentials). Leave blank to disable fallback entirely.
    anthropic_fallback_model: str = ""

    allowed_origins: str = "http://localhost:5173,https://exam-app-ey0.pages.dev"
    database_url: str = ""
    google_client_id: str = ""
    jwt_secret: str = ""
    admin_key: str = ""
    admin_master_secret: str = ""
    admin_key_rotation_period: str = "weekly"
    admin_key_log_path: str = "./admin_keys.txt"
    admin_key_log_enabled: bool = True
    admin_key_webhook_url: str = ""
    cron_secret: str = ""
    sqlite_path: str = "/data/app.db"
    payment_bank_name: str = ""
    payment_account_number: str = ""
    payment_account_name: str = ""

    app_url: str = "https://exam-app-ey0.pages.dev"

    def __init__(self, **data):
        super().__init__(**data)
        if not self.jwt_secret:
            raise RuntimeError("JWT_SECRET must be set in environment variables")
        if len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters")
        if self.admin_master_secret and len(self.admin_master_secret) < 32:
            raise RuntimeError("ADMIN_MASTER_SECRET must be at least 32 characters if set")
        if self.cron_secret and len(self.cron_secret) < 32:
            raise RuntimeError("CRON_SECRET must be at least 32 characters if set")
        if not self.google_client_id:
            raise RuntimeError("GOOGLE_CLIENT_ID must be set in environment variables")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def default_model(self) -> str:
        return self.anthropic_default_sonnet_model

    @property
    def opus_model(self) -> str:
        return self.anthropic_default_opus_model

    @property
    def haiku_model(self) -> str:
        return self.anthropic_default_haiku_model

    @property
    def hint_model(self) -> str:
        return self.anthropic_default_hint_model

    @property
    def fallback_model(self) -> str:
        return self.anthropic_fallback_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
