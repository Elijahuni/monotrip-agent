import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.limiter import limiter
from app.routes.ai import router as ai_router
from app.routes.auth import router as auth_router
from app.routes.checklist import router as checklist_router
from app.routes.notifications import router as notifications_router
from app.routes.places import router as places_router
from app.routes.saved_places import router as saved_places_router
from app.routes.trips import router as trips_router
from app.routes.uploads import router as uploads_router
from app.routes.collaboration import router as collaboration_router
from app.routes.community import router as community_router
from app.routes.metasearch import router as metasearch_router
from app.routes.realtime import router as realtime_router
from app.routes.utils import router as utils_router
from app.services.notification_scheduler import get_scheduler, setup_scheduler

# ─── structlog 설정 ──────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger("app")

# ─── Sentry 초기화 ────────────────────────────────────────────────────────────

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        environment=settings.app_env,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        # 개인정보 보호 — 요청 본문·쿠키·HTTP 헤더 수집 안 함
        send_default_pii=False,
        # 이미 global exception handler에서 structlog으로 로깅하므로 중복 방지
        before_send=lambda event, hint: event,
    )
    logger.info("sentry_initialized", environment=settings.app_env)
else:
    logger.info("sentry_disabled", reason="SENTRY_DSN not set")

# ─── 스케줄러 lifespan ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # 시작: 알림 스케줄러 등록 + 시작
    # SCHEDULER_ENABLED=false 면 스케줄러 비활성화 (테스트 / Railway 무료 플랜 등)
    scheduler_enabled = settings.app_env != "test"
    setup_scheduler(enabled=scheduler_enabled)
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        logger.info("notification_scheduler_started")

    yield  # 앱 실행 중

    # 종료: 스케줄러 graceful shutdown
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("notification_scheduler_stopped")


# ─── 앱 초기화 ────────────────────────────────────────────────────────────────

app = FastAPI(title="모노트립 Backend", version="0.4.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ─── 보안 헤더 미들웨어 ──────────────────────────────────────────────────────

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ─── request_id + 요청 로깅 미들웨어 ─────────────────────────────────────────

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    logger.info(
        "request_started",
        method=request.method,
        path=request.url.path,
    )
    response = await call_next(request)
    logger.info(
        "request_finished",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    response.headers["X-Request-ID"] = request_id
    return response


# ─── 글로벌 예외 핸들러 ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """처리되지 않은 예외 → 스택 트레이스 숨기고 일관된 에러 응답 반환."""
    logger.error(
        "unhandled_exception",
        exc_type=type(exc).__name__,
        exc_msg=str(exc),
        path=request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        },
    )


# ─── 라우터 등록 ─────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(ai_router)
app.include_router(places_router)
app.include_router(saved_places_router)
app.include_router(checklist_router)
app.include_router(uploads_router)
app.include_router(notifications_router)
app.include_router(utils_router)
app.include_router(metasearch_router)
app.include_router(collaboration_router)
app.include_router(realtime_router)
app.include_router(community_router)


# ─── 헬스체크 ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": app.version}
