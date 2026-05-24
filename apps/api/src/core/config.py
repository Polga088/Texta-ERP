from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://texta:texta@localhost:5432/texta_crm"
    database_url_sync: str = "postgresql://texta:texta@localhost:5432/texta_crm"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    api_url: str = "http://localhost:8000"
    web_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    admin_email: str = "admin@texta.local"
    admin_password: str = "Admin123!"
    billing_files_dir: str = "/tmp/texta/billing"
    billing_max_upload_mb: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
