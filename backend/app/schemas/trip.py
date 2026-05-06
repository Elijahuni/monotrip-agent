from datetime import date, datetime

from pydantic import BaseModel, Field


class LocationResponse(BaseModel):
    id: int
    trip_id: int
    name: str
    address: str
    latitude: float
    longitude: float
    category: str
    visit_order: int
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    thumbnail_url: str | None = None


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    thumbnail_url: str | None = None


class TripSummary(BaseModel):
    """목록 조회용 — locations 미포함"""

    id: int
    user_id: int
    title: str
    description: str | None
    start_date: date | None
    end_date: date | None
    thumbnail_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripResponse(TripSummary):
    """상세 조회용 — locations 포함"""

    locations: list[LocationResponse] = []
