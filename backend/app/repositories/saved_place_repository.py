from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_place import SavedPlace
from app.schemas.saved_place import SavedPlaceCreate


class SavedPlaceRepository:
    async def get_all_by_user(self, db: AsyncSession, user_id: int) -> list[SavedPlace]:
        stmt = select(SavedPlace).where(SavedPlace.user_id == user_id).order_by(SavedPlace.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, saved_place_id: int) -> SavedPlace | None:
        stmt = select(SavedPlace).where(SavedPlace.id == saved_place_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(self, db: AsyncSession, user_id: int, data: SavedPlaceCreate) -> SavedPlace:
        obj = SavedPlace(user_id=user_id, **data.model_dump())
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def delete(self, db: AsyncSession, obj: SavedPlace) -> None:
        await db.delete(obj)
        await db.flush()
