"""투어·티켓 메타서치 스키마.

여러 액티비티 OTA(Klook·KKday·Viator·MyRealTrip)의 상품을 단일 형식으로 정규화.
실제 제휴 API 도입 전까지는 결정론적 Mock Provider가 동작(data_source="mock").
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

DataSource = Literal["live", "mock"]
TourCategory = Literal["activity", "attraction", "tour", "transport", "show", "food"]


class TourOffer(BaseModel):
    id: str
    title: str
    category: str
    city: str
    price_krw: int
    currency: str = "KRW"
    duration_hours: float | None = None
    rating: float | None = None
    review_count: int | None = None
    thumbnail: str | None = None
    instant_confirmation: bool = False
    free_cancellation: bool = False
    deeplink: str  # 제휴 예약 페이지 URL
    affiliate_source: str  # "klook" | "kkday" | "viator" | "myrealtrip"


class TourSearchQuery(BaseModel):
    city: str = Field(min_length=1, max_length=60)
    category: TourCategory | None = None
    travel_date: date | None = None
    travelers: int = Field(default=1, ge=1, le=20)


class TourSearchResult(BaseModel):
    offers: list[TourOffer]
    providers_succeeded: list[str]
    providers_failed: list[str]
    data_source: DataSource = "mock"
