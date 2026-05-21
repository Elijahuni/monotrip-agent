"""공지사항 라우트 — 게시된 공지 목록/단건 조회 (읽기 전용)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.repositories.notice_repository import NoticeRepository
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/notices", tags=["notices"])
_repo = NoticeRepository()


class NoticeResponse(BaseModel):
    id: int
    category: str
    title: str
    body: str
    is_pinned: bool
    published_at: datetime
    model_config = {"from_attributes": True}


class NoticeListItem(BaseModel):
    """목록용 — 본문 제외(상세에서 조회)."""

    id: int
    category: str
    title: str
    is_pinned: bool
    published_at: datetime
    model_config = {"from_attributes": True}


@router.get("", response_model=ApiResponse[list[NoticeListItem]])
async def list_notices(
    current_user: CurrentUser,
    db: DbSession,
    category: Literal["general", "event", "maintenance", "update"] | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: int | None = Query(default=None, description="마지막으로 받은 notice_id (exclusive)"),
) -> ApiResponse[list[NoticeListItem]]:
    rows = await _repo.list_published(db, category=category, limit=limit, cursor=cursor)
    return ApiResponse(data=[NoticeListItem.model_validate(r) for r in rows])


@router.get("/{notice_id}", response_model=ApiResponse[NoticeResponse])
async def get_notice(
    notice_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[NoticeResponse]:
    notice = await _repo.get_published(db, notice_id)
    if notice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="공지사항을 찾을 수 없습니다."
        )
    return ApiResponse(data=NoticeResponse.model_validate(notice))
