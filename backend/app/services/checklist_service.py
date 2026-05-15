import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.checklist_repository import ChecklistRepository
from app.repositories.trip_repository import TripRepository
from app.schemas.checklist import ChecklistItemCreate, ChecklistItemResponse

logger = logging.getLogger(__name__)


class ChecklistService:
    def __init__(self) -> None:
        self.repo = ChecklistRepository()
        self.trip_repo = TripRepository()

    async def _assert_trip_access(self, db: AsyncSession, trip_id: int, user_id: int) -> None:
        trip = await self.trip_repo.get_by_id(db, trip_id)
        if trip is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다.")
        if trip.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")

    async def get_all(self, db: AsyncSession, trip_id: int, user_id: int) -> list[ChecklistItemResponse]:
        await self._assert_trip_access(db, trip_id, user_id)
        items = await self.repo.get_all_by_trip(db, trip_id)
        return [ChecklistItemResponse.model_validate(i) for i in items]

    async def add(self, db: AsyncSession, trip_id: int, user_id: int, data: ChecklistItemCreate) -> ChecklistItemResponse:
        await self._assert_trip_access(db, trip_id, user_id)
        item = await self.repo.create(db, trip_id, data)
        logger.info("Checklist item added: id=%s trip_id=%s", item.id, trip_id)
        return ChecklistItemResponse.model_validate(item)

    async def toggle(self, db: AsyncSession, trip_id: int, item_id: int, user_id: int, is_checked: bool) -> ChecklistItemResponse:
        await self._assert_trip_access(db, trip_id, user_id)
        item = await self.repo.get_by_id(db, item_id)
        if item is None or item.trip_id != trip_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="항목을 찾을 수 없습니다.")
        updated = await self.repo.toggle(db, item, is_checked)
        return ChecklistItemResponse.model_validate(updated)

    async def remove(self, db: AsyncSession, trip_id: int, item_id: int, user_id: int) -> None:
        await self._assert_trip_access(db, trip_id, user_id)
        item = await self.repo.get_by_id(db, item_id)
        if item is None or item.trip_id != trip_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="항목을 찾을 수 없습니다.")
        await self.repo.delete(db, item)
