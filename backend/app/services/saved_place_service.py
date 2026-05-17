import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.saved_place_repository import SavedPlaceRepository
from app.repositories.trip_repository import TripRepository
from app.schemas.saved_place import AddToTripRequest, SavedPlaceCreate, SavedPlaceResponse
from app.schemas.trip import LocationCreate, LocationResponse

logger = logging.getLogger(__name__)


class SavedPlaceService:
    def __init__(self) -> None:
        self.repo = SavedPlaceRepository()
        self.trip_repo = TripRepository()

    async def get_all(self, db: AsyncSession, user_id: int) -> list[SavedPlaceResponse]:
        items = await self.repo.get_all_by_user(db, user_id)
        return [SavedPlaceResponse.model_validate(i) for i in items]

    async def save(
        self, db: AsyncSession, user_id: int, data: SavedPlaceCreate
    ) -> SavedPlaceResponse:
        obj = await self.repo.create(db, user_id, data)
        logger.info("SavedPlace created: id=%s user_id=%s", obj.id, user_id)
        return SavedPlaceResponse.model_validate(obj)

    async def remove(self, db: AsyncSession, saved_place_id: int, user_id: int) -> None:
        obj = await self.repo.get_by_id(db, saved_place_id)
        if obj is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="저장된 장소를 찾을 수 없습니다."
            )
        if obj.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")
        await self.repo.delete(db, obj)

    async def add_to_trip(
        self, db: AsyncSession, saved_place_id: int, user_id: int, body: AddToTripRequest
    ) -> LocationResponse:
        saved = await self.repo.get_by_id(db, saved_place_id)
        if saved is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="저장된 장소를 찾을 수 없습니다."
            )
        if saved.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")

        trip = await self.trip_repo.get_by_id(db, body.trip_id)
        if trip is None or trip.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다."
            )

        loc_data = LocationCreate(
            name=saved.name,
            address=saved.address,
            latitude=saved.latitude,
            longitude=saved.longitude,
            category=saved.category,
            visit_order=body.visit_order,
            day_index=body.day_index,
            notes=saved.notes,
            google_place_id=saved.google_place_id,
            rating=saved.rating,
            images=saved.images,
            website=saved.website,
            phone=saved.phone,
            estimated_minutes=saved.estimated_minutes,
        )
        loc = await self.trip_repo.create_location(db, body.trip_id, loc_data)
        return LocationResponse.model_validate(loc)
