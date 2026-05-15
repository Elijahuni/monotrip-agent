from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/triple"

    # AI
    gemini_api_key: str = ""

    # 외부 API — 장소 검색
    google_places_api_key: str = ""

    # Auth (JWT)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30일

    # App
    app_env: str = "development"
    log_level: str = "INFO"

    # CORS (콤마 구분 문자열 또는 "*" 전부 허용)
    cors_origins: str = "*"

    # ── Cloudflare R2 (S3 호환 이미지 저장소) ──────────────────────────────────
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "monotrip-images"
    # 퍼블릭 액세스 URL (R2 커스텀 도메인 또는 r2.dev 서브도메인)
    r2_public_url: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
