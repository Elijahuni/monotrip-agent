from fastapi import APIRouter

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.schemas.checklist import ChecklistItemCreate, ChecklistItemResponse, ChecklistItemToggle
from app.schemas.common import ApiResponse
from app.services.checklist_service import ChecklistService

router = APIRouter(prefix="/trips/{trip_id}/checklist", tags=["checklist"])
_service = ChecklistService()


@router.get("", response_model=ApiResponse[list[ChecklistItemResponse]])
async def list_items(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[list[ChecklistItemResponse]]:
    items = await _service.get_all(db, trip_id, current_user.id)
    return ApiResponse(data=items)


@router.post("", response_model=ApiResponse[ChecklistItemResponse], status_code=201)
async def add_item(
    trip_id: int, body: ChecklistItemCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[ChecklistItemResponse]:
    item = await _service.add(db, trip_id, current_user.id, body)
    return ApiResponse(data=item)


@router.patch("/{item_id}", response_model=ApiResponse[ChecklistItemResponse])
async def toggle_item(
    trip_id: int, item_id: int, body: ChecklistItemToggle, current_user: CurrentUser, db: DbSession
) -> ApiResponse[ChecklistItemResponse]:
    item = await _service.toggle(db, trip_id, item_id, current_user.id, body.is_checked)
    return ApiResponse(data=item)


@router.delete("/{item_id}", response_model=ApiResponse[None])
async def delete_item(
    trip_id: int, item_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[None]:
    await _service.remove(db, trip_id, item_id, current_user.id)
    return ApiResponse(data=None, message="삭제되었습니다.")
