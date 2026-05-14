from datetime import date, datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    latitude: float
    longitude: float
    category: str = Field(min_length=1, max_length=50)
    visit_order: int = Field(default=0, ge=0)
    day_index: int = Field(default=1, ge=1)
    notes: str | None = None
    phone: str | None = None
    opening_hours: str | None = None
    estimated_minutes: int | None = None
    budget_per_person: int | None = None
    website: str | None = None
    rating: float | None = None
    images: str | None = None
    google_place_id: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    latitude: float | None = None
    longitude: float | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    visit_order: int | None = Field(default=None, ge=0)
    day_index: int | None = Field(default=None, ge=1)
    notes: str | None = None
    phone: str | None = None
    opening_hours: str | None = None
    estimated_minutes: int | None = None
    budget_per_person: int | None = None
    website: str | None = None
    rating: float | None = None
    images: str | None = None
    google_place_id: str | None = None


class LocationResponse(BaseModel):
    id: int
    trip_id: int
    name: str
    address: str
    latitude: float
    longitude: float
    category: str
    visit_order: int
    day_index: int
    notes: str | None
    phone: str | None = None
    opening_hours: str | None = None
    estimated_minutes: int | None = None
    budget_per_person: int | None = None
    website: str | None = None
    rating: float | None = None
    images: str | None = None
    google_place_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    thumbnail_url: str | None = None
    total_budget: int | None = None
    group_size: int = Field(default=1, ge=1)
    locations: list[LocationCreate] = Field(default_factory=list)


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    thumbnail_url: str | None = None
    total_budget: int | None = None
    group_size: int | None = Field(default=None, ge=1)


class TripSummary(BaseModel):
    id: int
    user_id: int
    title: str
    description: str | None
    start_date: date | None
    end_date: date | None
    thumbnail_url: str | None
    total_budget: int | None = None
    group_size: int = 1
    share_token: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripResponse(TripSummary):
    locations: list[LocationResponse] = []
