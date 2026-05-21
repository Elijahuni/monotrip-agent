"""고객센터 FAQ 라우트 — 게시된 FAQ 목록/단건 조회 (읽기 전용)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.repositories.faq_repository import FaqRepository
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/faqs", tags=["faqs"])
_repo = FaqRepository()

FaqCategory = Literal["general", "account", "booking", "payment", "travel", "etc"]


class FaqResponse(BaseModel):
    id: int
    category: str
    question: str
    answer: str
    model_config = {"from_attributes": True}


@router.get("", response_model=ApiResponse[list[FaqResponse]])
async def list_faqs(
    current_user: CurrentUser,
    db: DbSession,
    category: FaqCategory | None = Query(default=None),
) -> ApiResponse[list[FaqResponse]]:
    rows = await _repo.list_published(db, category=category)
    return ApiResponse(data=[FaqResponse.model_validate(r) for r in rows])


@router.get("/{faq_id}", response_model=ApiResponse[FaqResponse])
async def get_faq(
    faq_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[FaqResponse]:
    faq = await _repo.get_published(db, faq_id)
    if faq is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="FAQ를 찾을 수 없습니다."
        )
    return ApiResponse(data=FaqResponse.model_validate(faq))
