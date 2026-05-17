"""장소 검색 라우트."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser, get_current_user
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.curated_place import CuratedCategory, CuratedPlaceResponse
from app.schemas.place import PlaceSearchResponse, PlaceSearchResult
from app.schemas.trip import LocationResponse
from app.services.ai.user_profile_embedding import update_user_preference
from app.services.curated_place_service import CuratedPlaceService
from app.services.places_service import PlacesService, get_places_service


class CuratedAddToTripRequest(BaseModel):
    trip_id: int
    day_index: int = Field(default=1, ge=1)
    visit_order: int = Field(default=0, ge=0)


router = APIRouter(prefix="/places", tags=["places"])
_curated_service = CuratedPlaceService()


@router.get("/search", response_model=ApiResponse[PlaceSearchResponse])
@limiter.limit("30/minute")
async def search_places(
    request: Request,
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


@router.get("/curated", response_model=ApiResponse[list[CuratedPlaceResponse]])
@limiter.limit("60/minute")
async def list_curated_places(
    request: Request,
    db: DbSession,
    city: str = Query(
        ..., min_length=1, max_length=50, description="도시 키 또는 한글명 (예: tokyo, 도쿄)"
    ),
    category: CuratedCategory | None = Query(
        None,
        description="카테고리 (cafe/dessert/photospot/shopping/restaurant/bar/culture/nature/hotel)",
    ),
    vibes: list[str] | None = Query(
        None,
        max_length=8,
        description="vibe 태그 (반복 파라미터 가능, 예: vibes=빈티지&vibes=감성)",
    ),
    women_friendly: bool | None = Query(None, description="여성 친화 장소만"),
    limit: int = Query(30, ge=1, le=60),
    offset: int = Query(0, ge=0, le=600),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[list[CuratedPlaceResponse]]:
    """운영자 큐레이션 장소 목록. vibe 태그가 있으면 가중 정렬. 사용자 선호 임베딩으로 개인화."""
    user_emb = getattr(current_user, "preference_embedding", None)
    user_embedding = list(user_emb) if user_emb is not None and len(user_emb) > 0 else None
    items = await _curated_service.list_curated(
        db,
        city=city,
        category=category,
        vibes=vibes,
        women_friendly=women_friendly,
        user_embedding=user_embedding,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=items)


@router.get("/curated/{place_id}", response_model=ApiResponse[CuratedPlaceResponse])
async def get_curated_place(
    place_id: int,
    db: DbSession,
    _user: User = Depends(get_current_user),
) -> ApiResponse[CuratedPlaceResponse]:
    detail = await _curated_service.get_detail(db, place_id)
    return ApiResponse(data=detail)


@router.get(
    "/curated/{place_id}/similar",
    response_model=ApiResponse[list[CuratedPlaceResponse]],
)
async def list_similar_curated(
    place_id: int,
    db: DbSession,
    same_city_only: bool = Query(True, description="같은 도시 내에서만 검색"),
    limit: int = Query(6, ge=1, le=20),
    _user: User = Depends(get_current_user),
) -> ApiResponse[list[CuratedPlaceResponse]]:
    """pgvector 기반 의미 유사 큐레이션 장소."""
    items = await _curated_service.find_similar(
        db, place_id=place_id, same_city_only=same_city_only, limit=limit
    )
    return ApiResponse(data=items)


@router.post(
    "/curated/{place_id}/add-to-trip",
    response_model=ApiResponse[LocationResponse],
    status_code=201,
)
async def add_curated_to_trip(
    place_id: int,
    body: CuratedAddToTripRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[LocationResponse]:
    loc = await _curated_service.add_to_trip(
        db,
        place_id=place_id,
        trip_id=body.trip_id,
        user_id=current_user.id,
        day_index=body.day_index,
        visit_order=body.visit_order,
    )
    # 사용자 선호 임베딩 갱신 — 큐레이션 장소 추가 행동 누적
    background_tasks.add_task(
        update_user_preference,
        current_user.id,
        loc.name,
        loc.category,
        loc.address,
        loc.notes,
    )
    return ApiResponse(data=loc)
