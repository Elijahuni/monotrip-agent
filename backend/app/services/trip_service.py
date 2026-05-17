import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.repositories.trip_repository import TripRepository
from app.schemas.trip import LocationCreate, LocationResponse, LocationUpdate, TripCreate, TripPage, TripResponse, TripSummary, TripUpdate
from app.services.ai.embedding_service import embed_place, embed_query

logger = logging.getLogger(__name__)


class TripService:
    def __init__(self, repo: TripRepository | None = None) -> None:
        self.repo = repo or TripRepository()

    async def get_my_trips(self, db: AsyncSession, user_id: int) -> list[TripSummary]:
        trips = await self.repo.get_all_by_user(db, user_id)
        return [TripSummary.model_validate(t) for t in trips]

    async def get_my_trips_paginated(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 20,
        cursor: int | None = None,
    ) -> TripPage:
        trips, next_cursor, has_more = await self.repo.get_all_by_user_paginated(
            db, user_id, limit=limit, cursor=cursor
        )
        return TripPage(
            items=[TripSummary.model_validate(t) for t in trips],
            next_cursor=next_cursor,
            has_more=has_more,
        )

    async def get_trip(self, db: AsyncSession, trip_id: int, user_id: int) -> TripResponse:
        trip = await self.repo.get_by_id_with_locations(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        return TripResponse.model_validate(trip)

    async def create_trip(
        self, db: AsyncSession, user_id: int, data: TripCreate
    ) -> TripResponse:
        trip = await self.repo.create(db, user_id, data)
        if data.locations:
            await self.repo.create_locations_bulk(db, trip.id, data.locations)
            # locations relation 포함해서 다시 조회
            refreshed = await self.repo.get_by_id_with_locations(db, trip.id)
            logger.info(
                "Trip created with %d locations: id=%s user_id=%s",
                len(data.locations), trip.id, user_id,
            )
            return TripResponse.model_validate(refreshed)
        logger.info("Trip created: id=%s user_id=%s", trip.id, user_id)
        return TripResponse.model_validate(trip)

    async def update_trip(
        self, db: AsyncSession, trip_id: int, user_id: int, data: TripUpdate
    ) -> TripResponse:
        trip = await self.repo.get_by_id_with_locations(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        updated = await self.repo.update(db, trip, data)
        return TripResponse.model_validate(updated)

    async def delete_trip(self, db: AsyncSession, trip_id: int, user_id: int) -> None:
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        await self.repo.delete(db, trip)
        logger.info("Trip deleted: id=%s user_id=%s", trip_id, user_id)

    # ── Location 메서드 ────────────────────────────────────────────────────────

    async def add_location(
        self, db: AsyncSession, trip_id: int, user_id: int, data: LocationCreate
    ) -> LocationResponse:
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)

        duplicate = await self.repo.find_duplicate_location(db, trip_id, data)
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"이미 같은 장소가 추가되어 있습니다. (id={duplicate.id}, name={duplicate.name!r})",
            )

        location = await self.repo.create_location(db, trip_id, data)
        logger.info("Location added: id=%s trip_id=%s", location.id, trip_id)
        return LocationResponse.model_validate(location)

    async def embed_location_bg(self, location_id: int, data: LocationCreate) -> None:
        """BackgroundTask용: 독립 세션으로 임베딩 생성 후 저장. 실패 시 조용히 무시."""
        try:
            vector = await embed_place(
                name=data.name,
                category=data.category,
                address=data.address,
                notes=getattr(data, "notes", None),
            )
            if not vector:
                return
            async with AsyncSessionLocal() as session:
                await self.repo.update_embedding(session, location_id, vector)
                await session.commit()
        except Exception as exc:
            logger.warning("임베딩 저장 실패 location_id=%s: %s", location_id, exc)

    async def find_similar_locations(
        self,
        db: AsyncSession,
        trip_id: int,
        user_id: int,
        query: str,
        limit: int = 5,
    ) -> list[LocationResponse]:
        """자연어 쿼리로 여행 내 장소를 의미 검색. PostgreSQL+pgvector 필요."""
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)

        query_vector = await embed_query(query)
        if query_vector is None:
            raise HTTPException(
                status_code=503,
                detail="임베딩 서비스를 사용할 수 없습니다. GEMINI_API_KEY를 확인하세요.",
            )

        locations = await self.repo.find_similar_in_trip(db, trip_id, query_vector, limit)
        return [LocationResponse.model_validate(loc) for loc in locations]

    async def update_location(
        self,
        db: AsyncSession,
        trip_id: int,
        location_id: int,
        user_id: int,
        data: LocationUpdate,
        *,
        expected_version: int | None = None,
    ) -> LocationResponse:
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        location = await self.repo.get_location(db, location_id)
        if location is None or location.trip_id != trip_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"장소({location_id})를 찾을 수 없습니다.",
            )
        # 낙관적 동시성 — 클라가 기대한 version과 다르면 409 Conflict
        # 본문에 서버의 현재 상태를 함께 담아 클라가 머지 UI를 띄울 수 있게 한다.
        if expected_version is not None and location.version != expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "version_conflict",
                    "message": "다른 사용자가 먼저 수정했어요. 최신 내용을 확인해주세요.",
                    "current": LocationResponse.model_validate(location).model_dump(mode="json"),
                },
            )
        updated = await self.repo.update_location(db, location, data)
        return LocationResponse.model_validate(updated)

    async def delete_location(
        self, db: AsyncSession, trip_id: int, location_id: int, user_id: int
    ) -> None:
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        location = await self.repo.get_location(db, location_id)
        if location is None or location.trip_id != trip_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"장소({location_id})를 찾을 수 없습니다.",
            )
        await self.repo.delete_location(db, location)
        logger.info("Location deleted: id=%s trip_id=%s", location_id, trip_id)

    async def duplicate_trip(
        self, db: AsyncSession, trip_id: int, user_id: int
    ) -> TripResponse:
        """여행과 장소를 모두 복사해 새 여행으로 반환. 날짜·공유토큰은 초기화."""
        trip = await self.repo.get_by_id_with_locations(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)

        new_data = TripCreate(
            title=f"{trip.title} (복사본)",
            description=trip.description,
            start_date=None,
            end_date=None,
            thumbnail_url=trip.thumbnail_url,
            total_budget=trip.total_budget,
            group_size=trip.group_size,
        )
        new_trip = await self.repo.create(db, user_id, new_data)

        if trip.locations:
            locs = [
                LocationCreate(
                    name=loc.name,
                    address=loc.address,
                    latitude=loc.latitude,
                    longitude=loc.longitude,
                    category=loc.category,
                    visit_order=loc.visit_order,
                    day_index=loc.day_index,
                    notes=loc.notes,
                    phone=loc.phone,
                    opening_hours=loc.opening_hours,
                    estimated_minutes=loc.estimated_minutes,
                    budget_per_person=loc.budget_per_person,
                    website=loc.website,
                    rating=loc.rating,
                    images=loc.images,
                    google_place_id=loc.google_place_id,
                )
                for loc in trip.locations
            ]
            await self.repo.create_locations_bulk(db, new_trip.id, locs)

        result = await self.repo.get_by_id_with_locations(db, new_trip.id)
        logger.info("Trip duplicated: src=%s new=%s user_id=%s", trip_id, new_trip.id, user_id)
        return TripResponse.model_validate(result)

    @staticmethod
    def _assert_accessible(trip: object | None, trip_id: int, user_id: int) -> None:
        if trip is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"여행({trip_id})을 찾을 수 없습니다.",
            )
        if getattr(trip, "user_id", None) != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 여행에 접근할 권한이 없습니다.",
            )
