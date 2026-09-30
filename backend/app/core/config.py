from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore", case_sensitive=False)

    app_name: str = "MathIA API"
    environment: str = "development"
    auto_create_db: bool = True
    allow_demo_auth: bool = True
    jwt_secret: str = "local-demo-only-change-before-deploy-7f8d27"
    jwt_issuer: str | None = None
    jwt_audience: str | None = None
    jwt_jwks_url: str | None = None
    database_url: str = "postgresql+asyncpg://mathia:mathia@localhost:5432/mathia"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"
    rate_limit_per_minute: int = 90
    llm_requests_per_user_per_day: int = 80
    llm_provider: str = "demo"
    llm_model: str = "openai/gpt-4o-mini"
    llm_api_key: str | None = None
    embedding_model: str = "openai/text-embedding-3-small"
    embedding_dimensions: int = 1536
    mathpix_app_id: str | None = None
    mathpix_app_key: str | None = None
    enable_external_ocr: bool = False
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = "https://cloud.langfuse.com"
    sentry_dsn: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def protect_production_defaults(self) -> "Settings":
        if self.environment == "production":
            if self.allow_demo_auth:
                raise ValueError("ALLOW_DEMO_AUTH must be false in production")
            if self.jwt_secret.startswith("local-demo-only"):
                raise ValueError("JWT_SECRET must be changed in production")
            if not self.jwt_jwks_url:
                raise ValueError("JWT_JWKS_URL is required in production")
            if self.auto_create_db:
                raise ValueError("AUTO_CREATE_DB must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
