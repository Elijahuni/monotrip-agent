from fastapi import APIRouter

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.common import ApiResponse
from app.schemas.trip import TripCreate, TripResponse, TripSummary, TripUpdate
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
