"""메타서치 (항공/숙소 가격비교) 표준 스키마.

여러 OTA Provider의 응답을 단일 형식으로 정규화한다.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# ── 항공 ─────────────────────────────────────────────────────────────────────


class FlightSegment(BaseModel):
    """편도 한 구간 (직항이면 1개, 경유면 2개 이상)."""

    airline: str
    flight_number: str
    depart_airport: str  # IATA
    arrive_airport: str
    depart_time: datetime
    arrive_time: datetime
    duration_minutes: int


class FlightOffer(BaseModel):
    id: str  # provider 내부 식별자 (제공자별 prefix)
    price_krw: int  # 통일 통화: KRW (원)
    currency: str = "KRW"
    airline: str  # 대표 캐리어 (혼합 캐리어 시 첫 구간)
    stops: int = 0  # 경유 수 (0=직항)
    depart_time: datetime
    arrive_time: datetime
    duration_minutes: int
    segments: list[FlightSegment] = Field(default_factory=list)
    deeplink: str  # 예약 페이지 URL (어필리에이트 파라미터 포함)
    affiliate_source: str  # "skyscanner" | "naver" | "kayak" | "google_flights" | ...


class PriceTrend(BaseModel):
    signal: str  # buy_now | cheap | average | expensive | insufficient_data
    message: str
    current_min: int
    avg_7d: int | None = None
    avg_30d: int | None = None
    sample_count_30d: int = 0


DataSource = Literal["live", "mock"]


class FlightSearchResult(BaseModel):
    offers: list[FlightOffer]
    providers_succeeded: list[str]
    providers_failed: list[str]
    trend: PriceTrend | None = None
    # "mock" = 시뮬레이션 가격 (참고용) / "live" = 실제 어필리에이트 API
    data_source: DataSource = "mock"


# ── 숙소 ─────────────────────────────────────────────────────────────────────


class HotelOffer(BaseModel):
    id: str
    name: str
    price_per_night_krw: int
    total_price_krw: int  # nights × per_night + fees
    currency: str = "KRW"
    rating: float | None = None
    review_count: int | None = None
    star_rating: int | None = None  # 1~5성
    address: str
    latitude: float | None = None
    longitude: float | None = None
    thumbnail: str | None = None
    deeplink: str
    affiliate_source: str  # "booking" | "agoda" | "yanolja" | ...

    # 여성 친화·1인 여행 시그널 (Provider가 제공하면 채움, 없으면 None)
    women_floor: bool | None = None
    solo_friendly: bool | None = None


class HotelSearchResult(BaseModel):
    offers: list[HotelOffer]
    providers_succeeded: list[str]
    providers_failed: list[str]
    trend: PriceTrend | None = None
    data_source: DataSource = "mock"


# ── 검색 요청 (서비스 내부용) ──────────────────────────────────────────────────


class FlightSearchQuery(BaseModel):
    from_iata: str = Field(min_length=3, max_length=3)
    to_iata: str = Field(min_length=3, max_length=3)
    depart_date: date
    return_date: date | None = None  # 편도/왕복
    adults: int = Field(default=1, ge=1, le=9)
    cabin: Literal["economy", "premium_economy", "business", "first"] = "economy"


class HotelSearchQuery(BaseModel):
    city: str = Field(min_length=1, max_length=50)
    checkin: date
    checkout: date
    adults: int = Field(default=2, ge=1, le=8)
    rooms: int = Field(default=1, ge=1, le=4)
    min_rating: float | None = Field(default=None, ge=0, le=5)
    women_friendly_only: bool = False
