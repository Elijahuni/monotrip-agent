import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.trip_repository import TripRepository
from app.schemas.trip import LocationCreate, LocationResponse, LocationUpdate, TripCreate, TripResponse, TripSummary, TripUpdate

logger = logging.getLogger(__name__)


class TripService:
    def __init__(self, repo: TripRepository | None = None) -> None:
        self.repo = repo or TripRepository()

    async def get_my_trips(self, db: AsyncSession, user_id: int) -> list[TripSummary]:
        trips = await self.repo.get_all_by_user(db, user_id)
        return [TripSummary.model_validate(t) for t in trips]

    async def get_trip(self, db: AsyncSession, trip_id: int, user_id: int) -> TripResponse:
        trip = await self.repo.get_by_id_with_locations(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        return TripResponse.model_validate(trip)

    async def create_trip(
        self, db: AsyncSession, user_id: int, data: TripCreate
    ) -> TripResponse:
        trip = await self.repo.create(db, user_id, data)
        logger.info("Trip created: id=%s user_id=%s", trip.id, user_id)
        # 생성 직후 locations는 비어 있으므로 selectinload 불필요
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
        location = await self.repo.create_location(db, trip_id, data)
        logger.info("Location added: id=%s trip_id=%s", location.id, trip_id)
        return LocationResponse.model_validate(location)

    async def update_location(
        self,
        db: AsyncSession,
        trip_id: int,
        location_id: int,
        user_id: int,
        data: LocationUpdate,
    ) -> LocationResponse:
        trip = await self.repo.get_by_id(db, trip_id)
        self._assert_accessible(trip, trip_id, user_id)
        location = await self.repo.get_location(db, location_id)
        if location is None or location.trip_id != trip_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"장소({location_id})를 찾을 수 없습니다.",
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
