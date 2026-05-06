from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.trip import Trip
from app.schemas.trip import TripCreate, TripUpdate


class TripRepository:
    async def get_by_id(self, db: AsyncSession, trip_id: int) -> Trip | None:
        stmt = select(Trip).where(Trip.id == trip_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_id_with_locations(self, db: AsyncSession, trip_id: int) -> Trip | None:
        stmt = select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.locations))
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_all_by_user(self, db: AsyncSession, user_id: int) -> list[Trip]:
        stmt = select(Trip).where(Trip.user_id == user_id).order_by(Trip.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, user_id: int, data: TripCreate) -> Trip:
        trip = Trip(user_id=user_id, **data.model_dump())
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
        return trip

    async def update(self, db: AsyncSession, trip: Trip, data: TripUpdate) -> Trip:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(trip, field, value)
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
        return trip

    async def delete(self, db: AsyncSession, trip: Trip) -> None:
        await db.delete(trip)
        await db.flush()
