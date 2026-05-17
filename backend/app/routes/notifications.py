"""푸시 알림 토큰 관리 엔드포인트.

POST   /notifications/push-token   — 토큰 등록/갱신 (로그인 후 앱 시작 시)
DELETE /notifications/push-token   — 토큰 제거 (로그아웃 또는 권한 거부 시)
POST   /notifications/test          — 본인에게 테스트 알림 전송 (개발/스테이징 전용)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import get_settings
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.repositories.user_repository import UserRepository
from app.schemas.common import ApiResponse
from app.services.push_notification_service import PushMessage, send_push_notifications

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])

_user_repo = UserRepository()


class PushTokenBody(BaseModel):
    token: str = Field(min_length=10, max_length=200, description="ExponentPushToken[xxx]")


# ── 토큰 등록 / 갱신 ──────────────────────────────────────────────────────────


@router.post("/push-token", response_model=ApiResponse[None])
@limiter.limit("10/minute")
async def register_push_token(
    request: Request,
    body: PushTokenBody,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    """모바일 앱이 획득한 Expo push token을 서버에 등록한다.
    앱 시작 시마다 호출해 토큰 갱신을 보장한다."""
    # ExponentPushToken 또는 ExpoPushToken 형식 검증
    if not (body.token.startswith("ExponentPushToken[") or body.token.startswith("ExpoPushToken[")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="올바른 Expo push token 형식이 아닙니다.",
        )

    await _user_repo.update_push_token(db, current_user.id, body.token)
    logger.info("push_token_registered user_id=%s", current_user.id)
    return ApiResponse(data=None, message="푸시 알림 토큰이 등록되었습니다.")


# ── 토큰 제거 ─────────────────────────────────────────────────────────────────


@router.delete("/push-token", response_model=ApiResponse[None])
async def unregister_push_token(
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    """로그아웃 또는 알림 권한 거부 시 서버에서 토큰을 제거한다."""
    await _user_repo.update_push_token(db, current_user.id, None)
    logger.info("push_token_removed user_id=%s", current_user.id)
    return ApiResponse(data=None, message="푸시 알림 토큰이 제거되었습니다.")


# ── 테스트 알림 (개발/스테이징 전용) ─────────────────────────────────────────


@router.post("/test", response_model=ApiResponse[dict])
@limiter.limit("3/minute")
async def send_test_notification(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[dict]:
    """본인에게 테스트 알림을 즉시 전송한다. 프로덕션에서는 비활성화."""
    settings = get_settings()
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="테스트 알림은 프로덕션 환경에서 사용할 수 없습니다.",
        )

    # 현재 사용자 토큰 조회
    user = await _user_repo.get_by_id(db, current_user.id)
    if not user or not user.expo_push_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="등록된 푸시 토큰이 없습니다. 앱에서 알림 권한을 허용해 주세요.",
        )

    result = await send_push_notifications(
        [
            PushMessage(
                to=user.expo_push_token,
                title="🔔 모노트립 테스트 알림",
                body="알림이 정상적으로 수신되었습니다!",
                data={"type": "test"},
            )
        ]
    )

    return ApiResponse(data={"sent": result.sent, "failed": result.failed})
