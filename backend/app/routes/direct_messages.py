"""다이렉트 메시지(1:1 채팅) 라우트.

- GET    /dm/conversations          대화 목록(상대별 최신 메시지 + 미읽음 수)
- GET    /dm/unread-count            전체 미읽음 수(배지용)
- GET    /dm/{other_user_id}         스레드 조회(조회 시 수신분 읽음 처리)
- POST   /dm/{other_user_id}         메시지 전송
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.user import User
from app.repositories.direct_message_repository import DirectMessageRepository
from app.repositories.user_repository import UserRepository
from app.schemas.common import ApiResponse
from sqlalchemy import select

router = APIRouter(prefix="/dm", tags=["direct-messages"])
_repo = DirectMessageRepository()
_users = UserRepository()


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    body: str
    read_at: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    other_user_id: int
    other_nickname: str | None
    last_message: str
    last_at: datetime
    last_from_me: bool
    unread_count: int


async def _assert_user_exists(db: DbSession, user_id: int) -> None:
    user = (await db.execute(select(User.id).where(User.id == user_id))).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대상 사용자를 찾을 수 없습니다.")


@router.get("/conversations", response_model=ApiResponse[list[ConversationResponse]])
async def list_conversations(
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[ConversationResponse]]:
    rows = await _repo.list_conversations(db, current_user.id)
    return ApiResponse(data=[ConversationResponse(**c) for c in rows])


@router.get("/unread-count", response_model=ApiResponse[dict])
async def unread_count(
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[dict]:
    count = await _repo.unread_count(db, current_user.id)
    return ApiResponse(data={"unread": count})


@router.get("/{other_user_id}", response_model=ApiResponse[list[MessageResponse]])
async def get_thread(
    other_user_id: int,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=30, ge=1, le=100),
    cursor: int | None = Query(default=None, description="마지막으로 받은 message_id (exclusive)"),
) -> ApiResponse[list[MessageResponse]]:
    rows = await _repo.get_thread(db, current_user.id, other_user_id, limit=limit, cursor=cursor)
    # 스레드 조회 시 상대가 보낸 메시지를 읽음 처리
    await _repo.mark_read(db, current_user.id, other_user_id)
    return ApiResponse(data=[MessageResponse.model_validate(m) for m in rows])


@router.post("/{other_user_id}", response_model=ApiResponse[MessageResponse], status_code=201)
@limiter.limit("120/hour")
async def send_message(
    request: Request,
    other_user_id: int,
    body: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[MessageResponse]:
    if other_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신에게는 보낼 수 없습니다."
        )
    await _assert_user_exists(db, other_user_id)
    msg = await _repo.create(db, current_user.id, other_user_id, body.body)
    return ApiResponse(data=MessageResponse.model_validate(msg))
