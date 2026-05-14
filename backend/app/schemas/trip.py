from datetime import date, datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    latitude: float
    longitude: float
    category: str = Field(min_length=1, max_length=50)
    visit_order: int = Field(default=0, ge=0)
    notes: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    latitude: float | None = None
    longitude: float | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    visit_order: int | None = Field(default=None, ge=0)
    notes: str | None = None


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
    # AI 빌더 등에서 trip + locations를 한 번에 생성할 수 있게 옵션 필드.
    # 비어 있으면 trip만 만들고 locations는 별도 엔드포인트로 추가.
    locations: list[LocationCreate] = Field(default_factory=list)


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
