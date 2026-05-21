"""투어·티켓 메타서치 라우트 — 도시/카테고리 기반 상품 검색."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query, Request

from app.dependencies.auth import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.tours import TourCategory, TourSearchQuery, TourSearchResult
from app.services.tours import search_tours

from fastapi import Depends

router = APIRouter(prefix="/tours", tags=["tours"])


@router.get("/search", response_model=ApiResponse[TourSearchResult])
@limiter.limit("60/hour")
async def search_tour_tickets(
    request: Request,
    city: str = Query(min_length=1, max_length=60),
    category: TourCategory | None = Query(default=None),
    travel_date: date | None = Query(default=None, description="YYYY-MM-DD"),
    travelers: int = Query(default=1, ge=1, le=20),
    _user: User = Depends(get_current_user),
) -> ApiResponse[TourSearchResult]:
    q = TourSearchQuery(
        city=city, category=category, travel_date=travel_date, travelers=travelers
    )
    result = await search_tours(q)
    return ApiResponse(data=result)
