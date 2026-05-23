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

    # OAuth — 카카오 로그인
    kakao_client_id: str = ""  # 카카오 디벨로퍼스 REST API 키
    kakao_client_secret: str = ""  # 선택 — 보안 설정 사용 시
    kakao_redirect_uri: str = ""  # 모바일: tripleapp://oauth/kakao, 웹: https://...

    # Redis (멀티 워커 WebSocket pub/sub). 비워두면 단일 워커 인메모리 폴백.
    redis_url: str = ""  # 예: redis://localhost:6379/0

    # Auth (JWT)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 15  # access token: 15분 (짧게, 보안)
    jwt_refresh_expire_days: int = 7  # refresh token: 7일 (DB 저장, rotation)

    # App
    app_env: str = "development"
    log_level: str = "INFO"

    # CORS (콤마 구분 문자열 또는 "*" 전부 허용)
    cors_origins: str = "*"

    # ── 에러 모니터링 ────────────────────────────────────────────────────────────
    # 미설정 시 Sentry 비활성화 (개발/로컬 환경). 빈 문자열 = 비활성화.
    sentry_dsn: str = ""
    # 성능 트레이싱 샘플 비율 (0.0 ~ 1.0). 0.1 = 10% 트랜잭션 추적.
    sentry_traces_sample_rate: float = 0.1

    # ── Google OAuth ───────────────────────────────────────────────────────────
    # Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID
    # id_token audience 검증에 사용. 비어있으면 audience 검증 생략 (개발 환경)
    google_client_id: str = ""  # Web 클라이언트 ID (audience 검증 기준)
    google_ios_client_id: str = ""  # iOS 클라이언트 ID (expo app.json에도 입력)
    google_android_client_id: str = ""  # Android 클라이언트 ID

    # ── Apple Sign In ──────────────────────────────────────────────────────────
    # Apple Developer → Certificates, Identifiers & Profiles → Identifiers → App ID
    # Bundle ID (예: com.yourcompany.triple). 비어있으면 audience 검증 생략 (개발 환경)
    apple_client_id: str = ""

    # ── 메타서치 어필리에이트 API ──────────────────────────────────────────────
    # RapidAPI → Skyscanner Flight Search (Flights Live Prices v2)
    # https://rapidapi.com/skyscanner/api/skyscanner50
    rapidapi_key: str = ""  # RapidAPI 헤더: X-RapidAPI-Key
    # Amadeus Self-Service (공식 실시간 항공 GDS, 무료 티어)
    # https://developers.amadeus.com → Self-Service → API Key/Secret 발급
    amadeus_api_key: str = ""
    amadeus_api_secret: str = ""
    # "test"(test.api.amadeus.com, 무료/제한) | "production"(api.amadeus.com)
    amadeus_env: str = "test"
    # Booking.com Affiliate API (Demand API v2)
    # https://developers.booking.com/affiliate
    booking_affiliate_id: str = ""
    booking_affiliate_secret: str = ""  # OAuth2 client_secret
    # Agoda Affiliate API (파트너 승인 필요 — 승인 후 키/Site ID 발급)
    # https://partners.agoda.com → Affiliate → Content/Search API
    agoda_api_key: str = ""
    agoda_site_id: str = ""  # 어필리에이트 Site ID (cid)

    # ── 관리자 패널 ────────────────────────────────────────────────────────────
    # 숨겨진 URL 경로 (예: /admin-abc123xyz). openssl rand -hex 12 로 생성 권장.
    admin_secret_path: str = "admin-change-me-now"
    # HTTP Basic Auth 비밀번호 (username: admin)
    admin_password: str = "admin-password-change-me"
    # 어드민 접속 허용 IP/CIDR (콤마 구분). 비워두면 모든 IP 허용.
    # 예: "203.0.113.7, 10.0.0.0/8"
    admin_ip_allowlist: str = ""

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
            if self.admin_password.endswith("change-me"):
                raise ValueError(
                    "🚨 ADMIN_PASSWORD가 기본값입니다. "
                    "프로덕션 배포 전 강력한 비밀번호로 교체하세요."
                )
            if self.admin_secret_path.endswith("change-me-now"):
                raise ValueError(
                    "🚨 ADMIN_SECRET_PATH가 기본값입니다. openssl rand -hex 12 결과로 교체하세요."
                )
            if self.cors_origins.strip() == "*":
                raise ValueError(
                    "🚨 CORS_ORIGINS가 '*'입니다. allow_credentials=True와 함께 쓰면 "
                    "위험하므로 프로덕션에서는 허용 도메인을 명시하세요."
                )
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

    @property
    def admin_ip_allowlist_list(self) -> list[str]:
        return [ip.strip() for ip in self.admin_ip_allowlist.split(",") if ip.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
