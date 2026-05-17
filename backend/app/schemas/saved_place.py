from datetime import datetime

from pydantic import BaseModel, Field


class SavedPlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    latitude: float
    longitude: float
    category: str = Field(default="관광지", max_length=50)
    notes: str | None = None
    google_place_id: str | None = None
    rating: float | None = None
    images: list[str] | None = None
    website: str | None = None
    phone: str | None = None
    estimated_minutes: int | None = None


class SavedPlaceResponse(BaseModel):
    id: int
    user_id: int
    name: str
    address: str
    latitude: float
    longitude: float
    category: str
    notes: str | None = None
    google_place_id: str | None = None
    rating: float | None = None
    images: list[str] | None = None
    website: str | None = None
    phone: str | None = None
    estimated_minutes: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AddToTripRequest(BaseModel):
    trip_id: int
    day_index: int = Field(default=1, ge=1)
    visit_order: int = Field(default=0, ge=0)
