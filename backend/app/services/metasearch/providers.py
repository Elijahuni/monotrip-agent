"""OTA Provider 추상화 + 딥링크 빌더 + 시뮬레이션 가격 생성.

설계 의도:
- 실제 어필리에이트 API 통합은 키·계약 필요 (Skyscanner, Booking, 야놀자 등).
- 1차 출시: 검색 URL 딥링크 빌더 + 시뮬레이션 가격으로 UX 완결.
- 향후 각 Provider 클래스에서 실제 HTTP 호출로 치환 가능 (인터페이스 유지).
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from urllib.parse import urlencode

from app.schemas.metasearch import (
    FlightOffer,
    FlightSearchQuery,
    FlightSegment,
    HotelOffer,
    HotelSearchQuery,
)

logger = logging.getLogger(__name__)

# ── 도시 → IATA / 영문명 매핑 (호텔 검색용) ───────────────────────────────────
# 한글/영문 양쪽 입력 지원.
CITY_TO_BOOKING_QUERY: dict[str, str] = {
    "tokyo": "Tokyo, Japan",
    "도쿄": "Tokyo, Japan",
    "osaka": "Osaka, Japan",
    "오사카": "Osaka, Japan",
    "kyoto": "Kyoto, Japan",
    "교토": "Kyoto, Japan",
    "fukuoka": "Fukuoka, Japan",
    "후쿠오카": "Fukuoka, Japan",
    "seoul": "Seoul, South Korea",
    "서울": "Seoul, South Korea",
    "busan": "Busan, South Korea",
    "부산": "Busan, South Korea",
    "jeju": "Jeju, South Korea",
    "제주": "Jeju, South Korea",
    "gangneung": "Gangneung, South Korea",
    "강릉": "Gangneung, South Korea",
}


def normalize_city_for_hotels(city: str) -> str:
    key = city.strip().lower()
    return CITY_TO_BOOKING_QUERY.get(key, CITY_TO_BOOKING_QUERY.get(city, city))


# ── 딥링크 빌더 ──────────────────────────────────────────────────────────────


def skyscanner_flight_url(q: FlightSearchQuery) -> str:
    """Skyscanner 검색 URL. 어필리에이트 키 없이도 동작 (장기적으론 partner.skyscanner)."""
    # Format: /transport/flights/{from}/{to}/{YYMMDD}/{YYMMDD}/
    depart = q.depart_date.strftime("%y%m%d")
    ret = q.return_date.strftime("%y%m%d") if q.return_date else ""
    base = "https://www.skyscanner.co.kr/transport/flights"
    path = f"/{q.from_iata.lower()}/{q.to_iata.lower()}/{depart}"
    if ret:
        path += f"/{ret}"
    params = {"adults": q.adults, "cabinclass": q.cabin}
    return f"{base}{path}/?{urlencode(params)}"


def google_flights_url(q: FlightSearchQuery) -> str:
    """Google Flights 검색 URL (deeplink 폴백)."""
    parts = [q.from_iata.upper(), q.to_iata.upper(), q.depart_date.isoformat()]
    if q.return_date:
        parts.append(q.return_date.isoformat())
    return f"https://www.google.com/travel/flights?q={'+'.join(parts)}"


def naver_flight_url(q: FlightSearchQuery) -> str:
    """네이버 항공권 검색 URL."""
    flight_type = "RT" if q.return_date else "OW"
    params: dict[str, str | int] = {
        "trip": flight_type,
        "departureAirport": q.from_iata.upper(),
        "arrivalAirport": q.to_iata.upper(),
        "departureDate": q.depart_date.isoformat(),
        "adult": q.adults,
        "cabin": q.cabin.upper(),
    }
    if q.return_date:
        params["returnDate"] = q.return_date.isoformat()
    return "https://flight.naver.com/flights/?" + urlencode(params)


def kayak_flight_url(q: FlightSearchQuery) -> str:
    suffix = f"/{q.from_iata.upper()}-{q.to_iata.upper()}/{q.depart_date.isoformat()}"
    if q.return_date:
        suffix += f"/{q.return_date.isoformat()}"
    return f"https://www.kayak.com/flights{suffix}"


def booking_hotel_url(q: HotelSearchQuery) -> str:
    params = {
        "ss": normalize_city_for_hotels(q.city),
        "checkin": q.checkin.isoformat(),
        "checkout": q.checkout.isoformat(),
        "group_adults": q.adults,
        "no_rooms": q.rooms,
    }
    return "https://www.booking.com/searchresults.html?" + urlencode(params)


def agoda_hotel_url(q: HotelSearchQuery) -> str:
    params = {
        "city": normalize_city_for_hotels(q.city),
        "checkIn": q.checkin.isoformat(),
        "checkOut": q.checkout.isoformat(),
        "adults": q.adults,
        "rooms": q.rooms,
    }
    return "https://www.agoda.com/search?" + urlencode(params)


def yanolja_hotel_url(q: HotelSearchQuery) -> str:
    params = {
        "keyword": q.city,
        "checkInDate": q.checkin.isoformat(),
        "checkOutDate": q.checkout.isoformat(),
    }
    return "https://global.yanolja.com/ko/search?" + urlencode(params)


# ── 시뮬레이션 가격 (Mock Provider) ───────────────────────────────────────────
# 실제 API 통합 전까지 UX 완결을 위한 합성 데이터.
# 해시 기반 결정론적 — 같은 검색은 항상 같은 결과 (캐싱 친화적).


def _det_hash(seed: str) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)


def _mock_flight_offers(q: FlightSearchQuery) -> list[FlightOffer]:
    """검색 파라미터 기반 결정론적 mock — 5~7개 옵션."""
    base_seed = f"{q.from_iata}{q.to_iata}{q.depart_date}{q.return_date}"
    h = _det_hash(base_seed)

    # 거리·계절 기반 base price (단순 휴리스틱)
    is_japan = q.to_iata.upper() in {"NRT", "HND", "KIX", "ITM", "FUK", "CTS"}
    base_price = 280_000 if is_japan else 180_000  # 국내 vs 일본
    if q.return_date:
        base_price *= 2
    base_price = int(base_price * (0.85 + (h % 30) / 100))  # ±15% 변동

    airlines = [
        ("Korean Air", "KE", "skyscanner"),
        ("Asiana", "OZ", "naver"),
        ("Jeju Air", "7C", "skyscanner"),
        ("T'way Air", "TW", "kayak"),
        ("Jin Air", "LJ", "naver"),
        ("ANA", "NH", "skyscanner"),
        ("JAL", "JL", "google_flights"),
    ]

    offers: list[FlightOffer] = []
    n_offers = 5 + (h % 3)  # 5~7개
    for i in range(n_offers):
        airline_name, code, source = airlines[(h + i) % len(airlines)]
        # 가격 변동: 항공사·시간대별 ±20%
        price_jitter = ((h + i * 7) % 40) - 20
        price = int(base_price * (1 + price_jitter / 100))
        # 출발 시간 변형
        depart_hour = 7 + ((h + i * 3) % 14)
        depart_dt = datetime.combine(q.depart_date, datetime.min.time()).replace(hour=depart_hour)
        duration_min = 120 + (h + i) % 60 if is_japan else 60 + (h + i) % 30
        arrive_dt = depart_dt + timedelta(minutes=duration_min)
        stops = 0 if i < 4 else 1
        if stops:
            duration_min += 90

        segments = [
            FlightSegment(
                airline=airline_name,
                flight_number=f"{code}{(h + i) % 900 + 100}",
                depart_airport=q.from_iata.upper(),
                arrive_airport=q.to_iata.upper(),
                depart_time=depart_dt,
                arrive_time=arrive_dt,
                duration_minutes=duration_min,
            )
        ]

        # 실제 외부 검색 URL — 같은 query이므로 같은 페이지로
        if source == "skyscanner":
            link = skyscanner_flight_url(q)
        elif source == "naver":
            link = naver_flight_url(q)
        elif source == "kayak":
            link = kayak_flight_url(q)
        else:
            link = google_flights_url(q)

        offers.append(
            FlightOffer(
                id=f"{source}:{code}{i}:{base_seed[:8]}",
                price_krw=price,
                airline=airline_name,
                stops=stops,
                depart_time=depart_dt,
                arrive_time=arrive_dt,
                duration_minutes=duration_min,
                segments=segments,
                deeplink=link,
                affiliate_source=source,
            )
        )

    return offers


def _mock_hotel_offers(q: HotelSearchQuery) -> list[HotelOffer]:
    seed = f"{q.city}{q.checkin}{q.checkout}"
    h = _det_hash(seed)
    nights = max(1, (q.checkout - q.checkin).days)

    is_japan = q.city.lower() in {
        "tokyo",
        "osaka",
        "kyoto",
        "fukuoka",
        "도쿄",
        "오사카",
        "교토",
        "후쿠오카",
    }
    base_per_night = 180_000 if is_japan else 120_000

    hotels = [
        ("호텔 그랑디아", "booking", 4, True, True),
        ("MyStays 인", "agoda", 3, True, True),
        ("야놀자 시그니처", "yanolja", 4, False, True),
        ("Capsule Stay", "booking", 2, True, True),
        ("Ladies Floor Hotel", "booking", 4, True, True),
        ("Royal Park", "agoda", 5, False, False),
        ("로컬 호스텔", "booking", 2, False, True),
    ]

    offers: list[HotelOffer] = []
    n = 6 + (h % 2)
    for i in range(n):
        name_template, source, star, women_floor, solo = hotels[(h + i) % len(hotels)]
        name = f"{name_template} {q.city}"
        per_night = int(base_per_night * (0.7 + ((h + i * 11) % 80) / 100))
        rating = 3.8 + ((h + i * 5) % 12) / 10  # 3.8 ~ 5.0
        review_count = 100 + ((h + i * 17) % 9000)

        offers.append(
            HotelOffer(
                id=f"{source}:hotel{i}:{seed[:6]}",
                name=name,
                price_per_night_krw=per_night,
                total_price_krw=per_night * nights,
                rating=round(rating, 1),
                review_count=review_count,
                star_rating=star,
                address=f"{q.city} 시내",
                thumbnail=None,
                deeplink=(
                    booking_hotel_url(q)
                    if source == "booking"
                    else agoda_hotel_url(q)
                    if source == "agoda"
                    else yanolja_hotel_url(q)
                ),
                affiliate_source=source,
                women_floor=women_floor,
                solo_friendly=solo,
            )
        )

    return offers


# ── Provider 인터페이스 + 구현 ─────────────────────────────────────────────────


class FlightProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, q: FlightSearchQuery) -> list[FlightOffer]: ...


class HotelProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, q: HotelSearchQuery) -> list[HotelOffer]: ...


class MockFlightProvider(FlightProvider):
    """결정론적 시뮬레이션 — 실제 어필리에이트 API 도입 전까지의 stub."""

    name = "mock"

    async def search(self, q: FlightSearchQuery) -> list[FlightOffer]:
        return _mock_flight_offers(q)


class MockHotelProvider(HotelProvider):
    name = "mock"

    async def search(self, q: HotelSearchQuery) -> list[HotelOffer]:
        return _mock_hotel_offers(q)
