from fastapi import APIRouter

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.common import ApiResponse
from app.schemas.trip import LocationCreate, LocationResponse, LocationUpdate, TripCreate, TripResponse, TripSummary, TripUpdate
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["trips"])

_service = TripService()


@router.get("", response_model=ApiResponse[list[TripSummary]])
async def list_trips(current_user: CurrentUser, db: DbSession) -> ApiResponse[list[TripSummary]]:
    trips = await _service.get_my_trips(db, current_user.id)
    return ApiResponse(data=trips)


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


# ── Location 엔드포인트 ──────────────────────────────────────────────────────────

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


# ── 공유 (UP-7) ──────────────────────────────────────────────────────────────────

import secrets

from app.schemas.trip import TripSummary


@router.post("/{trip_id}/share", response_model=ApiResponse[dict])
async def share_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[dict]:
    trip = await _service.repo.get_by_id(db, trip_id)
    if trip is None or trip.user_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다.")
    if not trip.share_token:
        trip.share_token = secrets.token_urlsafe(16)
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
    from app.config import get_settings
    base = get_settings().api_base_url if hasattr(get_settings(), "api_base_url") else "http://localhost:8000"
    return ApiResponse(data={"share_token": trip.share_token, "share_url": f"{base}/trips/shared/{trip.share_token}"})


@router.get("/shared/{share_token}", response_model=ApiResponse[dict])
async def get_shared_trip(share_token: str, db: DbSession) -> ApiResponse[dict]:
    from sqlalchemy import select
    from app.models.trip import Trip
    from sqlalchemy.orm import selectinload
    stmt = select(Trip).where(Trip.share_token == share_token).options(selectinload(Trip.locations))
    result = await db.execute(stmt)
    trip = result.scalars().first()
    if trip is None:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="공유된 여행을 찾을 수 없습니다.")
    return ApiResponse(data={"trip": TripSummary.model_validate(trip).model_dump(), "locations": [loc.__dict__ for loc in trip.locations]})
