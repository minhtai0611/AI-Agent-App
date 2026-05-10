import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_base_url: str = "https://ai-router.locdo.tech"
    anthropic_auth_token: str

    anthropic_default_opus_model: str = "claude-opus-4.6"
    anthropic_default_sonnet_model: str = "claude-sonnet-4.6"
    anthropic_default_haiku_model: str = "claude-haiku-4.5"
    anthropic_default_hint_model: str = "claude-haiku-4.5"

    allowed_origins: str = "http://localhost:5173"
    database_url: str = ""
    # Set to "true" to run the background wiki crawl on startup.
    # Keep "false" on HF Spaces until local testing is complete.
    crawl_auto_seed_enabled: bool = False
    # Set to "true" to wipe wiki_units and re-crawl everything from scratch.
    # The app self-disables this flag via the HF Spaces API after one successful run.
    crawl_force_reseed: bool = False
    # Set to "true" to crawl only topics that have zero wiki units (gap-fill).
    # Idempotent: re-runs are safe — the zero-unit check is the gate.
    crawl_gap_fill_enabled: bool = False
    # Set to "true" to fix non-canonical topic/type labels and remove content duplicates on startup.
    # Self-disables via HF Spaces API after one successful run.
    wiki_sanitize_enabled: bool = False
    embedding_model_name: str = "BAAI/bge-m3"
    embedding_dim: int = 1024

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
