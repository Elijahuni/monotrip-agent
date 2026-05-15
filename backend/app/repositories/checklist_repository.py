from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checklist_item import ChecklistItem
from app.schemas.checklist import ChecklistItemCreate


class ChecklistRepository:
    async def get_all_by_trip(self, db: AsyncSession, trip_id: int) -> list[ChecklistItem]:
        stmt = select(ChecklistItem).where(ChecklistItem.trip_id == trip_id).order_by(ChecklistItem.created_at)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, item_id: int) -> ChecklistItem | None:
        stmt = select(ChecklistItem).where(ChecklistItem.id == item_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(self, db: AsyncSession, trip_id: int, data: ChecklistItemCreate) -> ChecklistItem:
        obj = ChecklistItem(trip_id=trip_id, **data.model_dump())
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def toggle(self, db: AsyncSession, item: ChecklistItem, is_checked: bool) -> ChecklistItem:
        item.is_checked = is_checked
        db.add(item)
        await db.flush()
        await db.refresh(item)
        return item

    async def delete(self, db: AsyncSession, item: ChecklistItem) -> None:
        await db.delete(item)
        await db.flush()

    async def delete_all_by_trip(self, db: AsyncSession, trip_id: int) -> None:
        items = await self.get_all_by_trip(db, trip_id)
        for item in items:
            await db.delete(item)
        await db.flush()
