from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_base_url: str = "https://ai-router.locdo.tech"
    anthropic_auth_token: str

    anthropic_default_opus_model: str = "claude-opus-4.6"
    anthropic_default_sonnet_model: str = "claude-sonnet-4.6"
    anthropic_default_haiku_model: str = "claude-haiku-4.5"

    allowed_origins: str = "http://localhost:5173"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
