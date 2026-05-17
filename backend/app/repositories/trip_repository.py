from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.location import Location
from app.models.trip import Trip
from app.schemas.trip import LocationCreate, LocationUpdate, TripCreate, TripUpdate


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

    async def get_all_by_user_paginated(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 20,
        cursor: int | None = None,
    ) -> tuple[list[Trip], int | None, bool]:
        """cursor 기반 페이지네이션.

        cursor = 마지막으로 받은 trip.id (exclusive).
        limit+1 개를 조회해 has_more를 판단한다.
        반환: (trips[:limit], next_cursor, has_more)
        """
        stmt = select(Trip).where(Trip.user_id == user_id)
        if cursor is not None:
            stmt = stmt.where(Trip.id < cursor)
        stmt = stmt.order_by(Trip.id.desc()).limit(limit + 1)

        result = await db.execute(stmt)
        trips = list(result.scalars().all())

        has_more = len(trips) > limit
        if has_more:
            trips = trips[:limit]

        next_cursor = trips[-1].id if has_more and trips else None
        return trips, next_cursor, has_more

    async def create(self, db: AsyncSession, user_id: int, data: TripCreate) -> Trip:
        # locations는 별도 단계에서 일괄 생성 (create_locations_bulk)
        trip = Trip(user_id=user_id, **data.model_dump(exclude={"locations"}))
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
        return trip

    async def create_locations_bulk(
        self, db: AsyncSession, trip_id: int, items: list[LocationCreate]
    ) -> list[Location]:
        """여러 장소를 한 번의 flush로 추가."""
        objs = [Location(trip_id=trip_id, **item.model_dump()) for item in items]
        db.add_all(objs)
        await db.flush()
        for obj in objs:
            await db.refresh(obj)
        return objs

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

    # ── Location CRUD ──────────────────────────────────────────────────────────

    async def get_location(self, db: AsyncSession, location_id: int) -> Location | None:
        stmt = select(Location).where(Location.id == location_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def find_duplicate_location(
        self,
        db: AsyncSession,
        trip_id: int,
        data: LocationCreate,
    ) -> Location | None:
        """동일 google_place_id 또는 동일 좌표(소수점 5자리 ≈ 1m 오차) 장소를 반환."""
        if data.google_place_id:
            stmt = select(Location).where(
                Location.trip_id == trip_id,
                Location.google_place_id == data.google_place_id,
            )
            result = await db.execute(stmt)
            return result.scalars().first()

        # google_place_id 없음 → 모든 위치를 Python에서 좌표 비교
        stmt = select(Location).where(Location.trip_id == trip_id)
        result = await db.execute(stmt)
        lat = round(data.latitude, 5)
        lng = round(data.longitude, 5)
        for loc in result.scalars().all():
            if round(loc.latitude, 5) == lat and round(loc.longitude, 5) == lng:
                return loc
        return None

    async def create_location(
        self, db: AsyncSession, trip_id: int, data: LocationCreate
    ) -> Location:
        location = Location(trip_id=trip_id, **data.model_dump())
        db.add(location)
        await db.flush()
        await db.refresh(location)
        return location

    async def update_location(
        self, db: AsyncSession, location: Location, data: LocationUpdate
    ) -> Location:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(location, field, value)
        # 낙관적 동시성: version 증가
        location.version = (location.version or 1) + 1
        db.add(location)
        await db.flush()
        await db.refresh(location)
        return location

    async def delete_location(self, db: AsyncSession, location: Location) -> None:
        await db.delete(location)
        await db.flush()

    # ── 임베딩 ──────────────────────────────────────────────────────────────────

    async def update_embedding(
        self, db: AsyncSession, location_id: int, vector: list[float]
    ) -> None:
        """Location.embedding 컬럼만 갱신. 별도 커밋 없이 flush만."""
        await db.execute(
            update(Location).where(Location.id == location_id).values(embedding=vector)
        )
        await db.flush()

    async def find_similar_in_trip(
        self,
        db: AsyncSession,
        trip_id: int,
        query_vector: list[float],
        limit: int = 5,
    ) -> list[Location]:
        """코사인 유사도 기반 유사 장소 검색 (PostgreSQL + pgvector 전용).

        embedding IS NOT NULL인 장소만 대상으로 하며, 거리 오름차순 정렬.
        SQLite에서는 빈 리스트를 반환한다.
        """
        # SQLAlchemy 2.x: engine dialect name 확인 (SQLite는 pgvector 미지원)
        try:
            dialect_name = db.get_bind().dialect.name  # type: ignore[union-attr]
        except Exception:
            dialect_name = "unknown"

        if dialect_name != "postgresql":
            return []

        # pgvector 코사인 거리 연산자 <=> 사용
        vector_literal = f"[{','.join(str(v) for v in query_vector)}]"
        stmt = (
            select(Location)
            .where(Location.trip_id == trip_id)
            .where(Location.embedding.isnot(None))
            .order_by(text(f"embedding <=> '{vector_literal}'::vector"))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    # ── 사용자 선호 추정 ───────────────────────────────────────────────────────

    async def get_top_categories(self, db: AsyncSession, user_id: int, limit: int = 3) -> list[str]:
        """사용자가 과거 등록한 장소의 카테고리 상위 N개. AI 프롬프트 보강용."""
        stmt = (
            select(Location.category, func.count(Location.id).label("cnt"))
            .join(Trip, Trip.id == Location.trip_id)
            .where(Trip.user_id == user_id)
            .group_by(Location.category)
            .order_by(func.count(Location.id).desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]
