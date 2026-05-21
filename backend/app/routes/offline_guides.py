"""오프라인 가이드 라우트 — 목록(메타) + 상세(다운로드용 전체 콘텐츠)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.repositories.offline_guide_repository import OfflineGuideRepository
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/offline-guides", tags=["offline-guides"])
_repo = OfflineGuideRepository()


class GuideSection(BaseModel):
    heading: str
    body: str


class GuideListItem(BaseModel):
    """목록용 — 섹션 본문 제외(다운로드 용량/버전만)."""

    id: int
    city: str
    country: str
    title: str
    summary: str
    cover_image: str | None
    language: str
    file_size_kb: int
    version: int
    updated_at: datetime
    model_config = {"from_attributes": True}


class GuideDetail(GuideListItem):
    sections: list[GuideSection]


@router.get("", response_model=ApiResponse[list[GuideListItem]])
async def list_offline_guides(
    current_user: CurrentUser,
    db: DbSession,
    city: str | None = Query(default=None, max_length=60),
) -> ApiResponse[list[GuideListItem]]:
    rows = await _repo.list_published(db, city=city)
    return ApiResponse(data=[GuideListItem.model_validate(r) for r in rows])


@router.get("/{guide_id}", response_model=ApiResponse[GuideDetail])
async def get_offline_guide(
    guide_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[GuideDetail]:
    guide = await _repo.get_published(db, guide_id)
    if guide is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="가이드를 찾을 수 없습니다."
        )
    sections = [GuideSection(**s) for s in (guide.sections or [])]
    detail = GuideDetail(
        id=guide.id,
        city=guide.city,
        country=guide.country,
        title=guide.title,
        summary=guide.summary,
        cover_image=guide.cover_image,
        language=guide.language,
        file_size_kb=guide.file_size_kb,
        version=guide.version,
        updated_at=guide.updated_at,
        sections=sections,
    )
    return ApiResponse(data=detail)
