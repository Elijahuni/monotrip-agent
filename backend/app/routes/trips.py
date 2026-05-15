import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.models.trip import Trip
from app.schemas.common import ApiResponse
from app.schemas.trip import (
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    TripCreate,
    TripPage,
    TripResponse,
    TripSummary,
    TripUpdate,
)
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["trips"])

_service = TripService()

_SHARE_TOKEN_DAYS = 30  # 공유 토큰 유효 기간


# ── Trip CRUD ────────────────────────────────────────────────────────────────

@router.get("", response_model=ApiResponse[TripPage])
async def list_trips(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=20, ge=1, le=100, description="페이지당 항목 수"),
    cursor: int | None = Query(default=None, description="이전 페이지 마지막 trip.id (커서)"),
) -> ApiResponse[TripPage]:
    page = await _service.get_my_trips_paginated(db, current_user.id, limit=limit, cursor=cursor)
    return ApiResponse(data=page)


@router.post("", response_model=ApiResponse[TripResponse], status_code=201)
async def create_trip(
    body: TripCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.create_trip(db, current_user.id, body)
    return ApiResponse(data=trip)


@router.get("/{trip_id}", response_model=ApiResponse[TripResponse])
async def get_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.get_trip(db, trip_id, current_user.id)
    return ApiResponse(data=trip)


@router.patch("/{trip_id}", response_model=ApiResponse[TripResponse])
async def update_trip(
    trip_id: int, body: TripUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.update_trip(db, trip_id, current_user.id, body)
    return ApiResponse(data=trip)


@router.delete("/{trip_id}", response_model=ApiResponse[None])
async def delete_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    await _service.delete_trip(db, trip_id, current_user.id)
    return ApiResponse(data=None, message="삭제되었습니다.")


# ── Location 엔드포인트 ──────────────────────────────────────────────────────

@router.post(
    "/{trip_id}/locations",
    response_model=ApiResponse[LocationResponse],
    status_code=201,
)
async def add_location(
    trip_id: int, body: LocationCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[LocationResponse]:
    location = await _service.add_location(db, trip_id, current_user.id, body)
    return ApiResponse(data=location)


@router.patch(
    "/{trip_id}/locations/{location_id}",
    response_model=ApiResponse[LocationResponse],
)
async def update_location(
    trip_id: int,
    location_id: int,
    body: LocationUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[LocationResponse]:
    location = await _service.update_location(db, trip_id, location_id, current_user.id, body)
    return ApiResponse(data=location)


@router.delete("/{trip_id}/locations/{location_id}", response_model=ApiResponse[None])
async def delete_location(
    trip_id: int, location_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    await _service.delete_location(db, trip_id, location_id, current_user.id)
    return ApiResponse(data=None, message="장소가 삭제되었습니다.")


# ── 공유 (UP-7) ───────────────────────────────────────────────────────────────

@router.post("/{trip_id}/share", response_model=ApiResponse[dict])
async def share_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[dict]:
    """공유 토큰 발급 (없으면 신규 생성, 있으면 재사용). 만료 30일."""
    trip = await _service.repo.get_by_id(db, trip_id)
    if trip is None or trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다.")

    now = datetime.now(timezone.utc)
    # 토큰이 없거나 만료됐으면 새로 발급
    needs_new_token = (
        not trip.share_token
        or trip.share_token_expires_at is None
        or trip.share_token_expires_at < now
    )
    if needs_new_token:
        trip.share_token = secrets.token_urlsafe(16)
        trip.share_token_expires_at = now + timedelta(days=_SHARE_TOKEN_DAYS)
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

    settings = get_settings()
    base = getattr(settings, "api_base_url", "http://localhost:8000")
    expires_iso = trip.share_token_expires_at.isoformat() if trip.share_token_expires_at else None
    return ApiResponse(data={
        "share_token": trip.share_token,
        "share_url": f"{base}/trips/shared/{trip.share_token}",
        "expires_at": expires_iso,
    })


@router.get("/shared/{share_token}", response_model=ApiResponse[dict])
async def get_shared_trip(share_token: str, db: DbSession) -> ApiResponse[dict]:
    """공유 링크로 여행 열람 (인증 불필요). 만료 토큰은 404 반환."""
    stmt = select(Trip).where(Trip.share_token == share_token).options(selectinload(Trip.locations))
    result = await db.execute(stmt)
    trip = result.scalars().first()

    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공유된 여행을 찾을 수 없습니다.")

    # 만료 체크
    now = datetime.now(timezone.utc)
    if trip.share_token_expires_at and trip.share_token_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="공유 링크가 만료되었습니다. 여행 주인에게 재공유를 요청하세요.",
        )

    return ApiResponse(data={
        "trip": TripSummary.model_validate(trip).model_dump(),
        "locations": [loc.__dict__ for loc in trip.locations],
    })


# ── 여행 복제 (U7) ────────────────────────────────────────────────────────────

@router.post("/{trip_id}/duplicate", response_model=ApiResponse[TripResponse], status_code=201)
async def duplicate_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    """여행과 모든 장소를 복사. 날짜·공유토큰은 초기화."""
    trip = await _service.duplicate_trip(db, trip_id, current_user.id)
    return ApiResponse(data=trip, message="여행이 복제되었습니다.")
