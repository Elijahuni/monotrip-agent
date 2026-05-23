"""렌터카·보험 메타서치 스키마.

여러 렌터카 OTA(Rentalcars·Klook·롯데렌터카 등)의 차량+보험 상품을 단일 형식으로 정규화.
실제 제휴 API 도입 전까지는 결정론적 Mock Provider가 동작(data_source="mock").
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

DataSource = Literal["live", "mock"]
CarClass = Literal["economy", "compact", "midsize", "suv", "van", "luxury"]
InsuranceLevel = Literal["none", "basic", "full"]


class RentalCarOffer(BaseModel):
    id: str
    vendor: str  # Hertz | Avis | SIXT | 롯데렌터카 | ...
    car_class: str
    car_model: str  # 예: "현대 아반떼 또는 동급"
    transmission: str  # auto | manual
    seats: int
    price_per_day_krw: int
    total_price_krw: int  # days × per_day (+보험)
    currency: str = "KRW"
    # 보험
    insurance_level: str  # none | basic | full
    insurance_included: bool = False
    insurance_price_krw: int = 0  # 자차/대인 등 보험 추가 비용(포함이면 0)
    free_cancellation: bool = False
    unlimited_mileage: bool = False
    deeplink: str  # 제휴 예약 페이지 URL
    affiliate_source: str  # "rentalcars" | "klook" | "lotte" | "sixt"


class RentalCarSearchQuery(BaseModel):
    city: str = Field(min_length=1, max_length=60)
    pickup_date: date
    return_date: date
    driver_age: int = Field(default=30, ge=18, le=99)
    insurance_level: InsuranceLevel | None = None  # 필터: 원하는 보험 수준


class RentalCarSearchResult(BaseModel):
    offers: list[RentalCarOffer]
    providers_succeeded: list[str]
    providers_failed: list[str]
    rental_days: int
    data_source: DataSource = "mock"
