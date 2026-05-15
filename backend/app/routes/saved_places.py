from fastapi import APIRouter

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.common import ApiResponse
from app.schemas.saved_place import AddToTripRequest, SavedPlaceCreate, SavedPlaceResponse
from app.schemas.trip import LocationResponse
from app.services.saved_place_service import SavedPlaceService

router = APIRouter(prefix="/saved-places", tags=["saved-places"])
_service = SavedPlaceService()


@router.get("", response_model=ApiResponse[list[SavedPlaceResponse]])
async def list_saved(current_user: CurrentUser, db: DbSession) -> ApiResponse[list[SavedPlaceResponse]]:
    items = await _service.get_all(db, current_user.id)
    return ApiResponse(data=items)


@router.post("", response_model=ApiResponse[SavedPlaceResponse], status_code=201)
async def save_place(
    body: SavedPlaceCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[SavedPlaceResponse]:
    item = await _service.save(db, current_user.id, body)
    return ApiResponse(data=item)


@router.delete("/{saved_place_id}", response_model=ApiResponse[None])
async def remove_saved(
    saved_place_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    await _service.remove(db, saved_place_id, current_user.id)
    return ApiResponse(data=None, message="삭제되었습니다.")


@router.post("/{saved_place_id}/add-to-trip", response_model=ApiResponse[LocationResponse], status_code=201)
async def add_to_trip(
    saved_place_id: int, body: AddToTripRequest, current_user: CurrentUser, db: DbSession
) -> ApiResponse[LocationResponse]:
    loc = await _service.add_to_trip(db, saved_place_id, current_user.id, body)
    return ApiResponse(data=loc)
