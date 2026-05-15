from functools import lru_cache

from pydantic import model_validator
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

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """프로덕션 환경에서 안전하지 않은 기본값이 있으면 즉시 서버 시작 실패."""
        if self.is_production:
            if self.jwt_secret.startswith("change"):
                raise ValueError(
                    "🚨 JWT_SECRET이 기본값입니다. "
                    "프로덕션 배포 전 openssl rand -hex 32 결과로 교체하세요."
                )
            if not self.gemini_api_key:
                raise ValueError("🚨 GEMINI_API_KEY가 설정되지 않았습니다.")
        return self

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
