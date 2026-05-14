"""장소 검색 라우트."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.place import PlaceSearchResponse, PlaceSearchResult
from app.services.places_service import PlacesService, get_places_service

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/search", response_model=ApiResponse[PlaceSearchResponse])
async def search_places(
    query: str = Query(..., min_length=1, max_length=200),
    lat: float | None = Query(None, ge=-90, le=90, description="결과 편향 중심 위도"),
    lng: float | None = Query(None, ge=-180, le=180, description="결과 편향 중심 경도"),
    language: str = Query("ko", min_length=2, max_length=5),
    _user: User = Depends(get_current_user),
    service: PlacesService = Depends(get_places_service),
) -> ApiResponse[PlaceSearchResponse]:
    """Google Places API로 장소를 검색해 정규화된 결과 리스트 반환."""
    results: list[PlaceSearchResult] = await service.search_text(
        query=query,
        near_latitude=lat,
        near_longitude=lng,
        language=language,
    )
    return ApiResponse(
        success=True,
        data=PlaceSearchResponse(results=results),
        message="success",
    )
