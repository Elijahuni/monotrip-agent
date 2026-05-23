"""OTA Provider 추상화 + 딥링크 빌더 + 실/Mock 가격.

실연동 구조:
  SkyscannerProvider  — RapidAPI Skyscanner Flight Search v2 (rapidapi_key 설정 시 활성)
  BookingProvider     — Booking.com Affiliate Demand API v2 (booking_affiliate_id 설정 시 활성)
  MockFlightProvider  — 결정론적 시뮬레이션 (항상 폴백)
  MockHotelProvider   — 결정론적 시뮬레이션 (항상 폴백)

data_source 필드:
  "live" — 실제 어필리에이트 API에서 조회한 가격
  "mock" — 시뮬레이션 참고 가격 (참고용 배지를 UI에 표시)
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx

from app.config import get_settings
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


# ── 실제 어필리에이트 Provider ─────────────────────────────────────────────────
# rapidapi_key / booking_affiliate_id 가 설정된 경우에만 aggregator에서 활성화됨.


class SkyscannerProvider(FlightProvider):
    """RapidAPI Skyscanner Flight Search v2 실연동.

    엔드포인트: GET /flights/live/search/create (비동기 폴링 방식)
    - 1단계: create → sessionToken 획득
    - 2단계: poll → status=RESULT_STATUS_COMPLETE 될 때까지 최대 3회 재시도

    가격 통화: USD → KRW 변환 (간이 환율: USDKRW_RATE)
    공식 문서: https://rapidapi.com/skyscanner/api/skyscanner50
    """

    name = "skyscanner"
    _BASE = "https://skyscanner50.p.rapidapi.com/api/v1"
    _USDKRW_RATE = 1350  # 고정 환율 — 실제 환율 API 연동 시 교체

    def __init__(self, api_key: str) -> None:
        self._key = api_key
        self._headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "skyscanner50.p.rapidapi.com",
        }

    async def search(self, q: FlightSearchQuery) -> list[FlightOffer]:
        params = {
            "origin": q.from_iata.upper(),
            "destination": q.to_iata.upper(),
            "date": q.depart_date.strftime("%Y-%m-%d"),
            "adults": str(q.adults),
            "currency": "USD",
            "countryCode": "KR",
            "market": "KR",
            "locale": "ko-KR",
            "cabinClass": _cabin_code(q.cabin),
        }
        if q.return_date:
            params["returnDate"] = q.return_date.strftime("%Y-%m-%d")

        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"{self._BASE}/flights",
                headers=self._headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

        return self._parse(data, q)

    def _parse(self, data: dict, q: FlightSearchQuery) -> list[FlightOffer]:
        offers: list[FlightOffer] = []
        itineraries = data.get("data", {}).get("itineraries", [])
        for it in itineraries[:10]:  # 상위 10개만
            try:
                price_usd = float(it["price"]["raw"])
                price_krw = int(price_usd * self._USDKRW_RATE)
                leg = it["legs"][0]
                airline = leg.get("carriers", {}).get("marketing", [{}])[0].get("name", "Unknown")
                depart_dt = datetime.fromisoformat(leg["departure"].replace("Z", "+00:00"))
                arrive_dt = datetime.fromisoformat(leg["arrival"].replace("Z", "+00:00"))
                duration = leg.get("durationInMinutes", 0)
                stops = leg.get("stopCount", 0)
                deeplink = it.get("deeplink") or skyscanner_flight_url(q)
                seg = FlightSegment(
                    airline=airline,
                    flight_number=leg.get("flightNumber", ""),
                    depart_airport=q.from_iata.upper(),
                    arrive_airport=q.to_iata.upper(),
                    depart_time=depart_dt,
                    arrive_time=arrive_dt,
                    duration_minutes=duration,
                )
                offers.append(
                    FlightOffer(
                        id=f"skyscanner:{it.get('id', '')}",
                        price_krw=price_krw,
                        airline=airline,
                        stops=stops,
                        depart_time=depart_dt,
                        arrive_time=arrive_dt,
                        duration_minutes=duration,
                        segments=[seg],
                        deeplink=deeplink,
                        affiliate_source="skyscanner",
                    )
                )
            except Exception as e:
                logger.debug("skyscanner parse error: %s", e)
        return offers


def _cabin_code(cabin: str) -> str:
    return {"economy": "economy", "business": "business", "first": "first"}.get(
        cabin.lower(), "economy"
    )


def _iso8601_duration_to_minutes(iso: str) -> int:
    """ISO-8601 기간(PT5H30M, PT45M 등)을 분으로 변환. 실패 시 0."""
    import re

    m = re.match(r"^PT(?:(\d+)H)?(?:(\d+)M)?$", iso or "")
    if not m:
        return 0
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    return hours * 60 + minutes


class AmadeusProvider(FlightProvider):
    """Amadeus Self-Service Flight Offers Search — 공식 실시간 항공 GDS.

    무료 티어(test 환경) 또는 production 환경 모두 지원.
    1) OAuth2 client_credentials 로 access_token 발급 (만료 전까지 캐시)
    2) GET /v2/shopping/flight-offers 로 실시간 항공권 조회 (currencyCode=KRW)

    딥링크는 Self-Service에 포함되지 않으므로 Google Flights 검색 URL로 폴백.
    공식 문서: https://developers.amadeus.com/self-service/category/flights
    """

    name = "amadeus"

    def __init__(self, api_key: str, api_secret: str, env: str = "test") -> None:
        self._key = api_key
        self._secret = api_secret
        self._base = (
            "https://api.amadeus.com" if env == "production" else "https://test.api.amadeus.com"
        )
        self._token: str | None = None
        self._token_expiry: float = 0.0  # epoch seconds

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        import time

        if self._token and time.time() < self._token_expiry - 30:
            return self._token
        resp = await client.post(
            f"{self._base}/v1/security/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self._key,
                "client_secret": self._secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        body = resp.json()
        self._token = body["access_token"]
        self._token_expiry = time.time() + int(body.get("expires_in", 1799))
        return self._token

    async def search(self, q: FlightSearchQuery) -> list[FlightOffer]:
        params = {
            "originLocationCode": q.from_iata.upper(),
            "destinationLocationCode": q.to_iata.upper(),
            "departureDate": q.depart_date.strftime("%Y-%m-%d"),
            "adults": str(q.adults),
            "currencyCode": "KRW",
            "max": "10",
            "travelClass": q.cabin.upper(),
        }
        if q.return_date:
            params["returnDate"] = q.return_date.strftime("%Y-%m-%d")

        async with httpx.AsyncClient(timeout=12.0) as client:
            token = await self._get_token(client)
            resp = await client.get(
                f"{self._base}/v2/shopping/flight-offers",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
        return self._parse(data, q)

    def _parse(self, data: dict, q: FlightSearchQuery) -> list[FlightOffer]:
        offers: list[FlightOffer] = []
        for offer in data.get("data", [])[:10]:
            try:
                price_krw = int(float(offer["price"]["total"]))
                outbound = offer["itineraries"][0]
                raw_segments = outbound["segments"]
                stops = max(0, len(raw_segments) - 1)

                segments: list[FlightSegment] = []
                for s in raw_segments:
                    dep_at = datetime.fromisoformat(s["departure"]["at"])
                    arr_at = datetime.fromisoformat(s["arrival"]["at"])
                    segments.append(
                        FlightSegment(
                            airline=s.get("carrierCode", ""),
                            flight_number=f"{s.get('carrierCode', '')}{s.get('number', '')}",
                            depart_airport=s["departure"]["iataCode"],
                            arrive_airport=s["arrival"]["iataCode"],
                            depart_time=dep_at,
                            arrive_time=arr_at,
                            duration_minutes=_iso8601_duration_to_minutes(s.get("duration", "")),
                        )
                    )

                first, last = segments[0], segments[-1]
                total_minutes = _iso8601_duration_to_minutes(outbound.get("duration", ""))
                if total_minutes == 0:
                    total_minutes = int(
                        (last.arrive_time - first.depart_time).total_seconds() // 60
                    )
                offers.append(
                    FlightOffer(
                        id=f"amadeus:{offer.get('id', '')}",
                        price_krw=price_krw,
                        airline=first.airline,
                        stops=stops,
                        depart_time=first.depart_time,
                        arrive_time=last.arrive_time,
                        duration_minutes=total_minutes,
                        segments=segments,
                        deeplink=google_flights_url(q),
                        affiliate_source="amadeus",
                    )
                )
            except Exception as e:
                logger.debug("amadeus parse error: %s", e)
        return offers


class RapidApiBookingProvider(HotelProvider):
    """RapidAPI의 Booking.com 래퍼 API 실연동.

    공식 Affiliate 승인 없이 RAPIDAPI_KEY 하나로 즉시 사용 가능.
    API: booking-com15 (DataCrawler) — https://rapidapi.com/DataCrawler/api/booking-com15
    엔드포인트: GET /api/v1/hotels/searchHotels

    RAPIDAPI_KEY 설정 시 자동 활성화 (BookingProvider보다 우선순위 낮음).
    """

    name = "booking_rapidapi"
    _BASE = "https://booking-com15.p.rapidapi.com/api/v1/hotels"

    def __init__(self, rapidapi_key: str) -> None:
        self._key = rapidapi_key
        self._headers = {
            "X-RapidAPI-Key": rapidapi_key,
            "X-RapidAPI-Host": "booking-com15.p.rapidapi.com",
        }

    async def _get_dest_id(self, city: str) -> str | None:
        """도시 이름 → Booking.com dest_id 조회."""
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{self._BASE}/searchDestination",
                params={"query": normalize_city_for_hotels(city), "locale": "ko"},
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
        results = data.get("data", [])
        if not results:
            return None
        # 첫 번째 결과(도시 타입 우선)
        for item in results:
            if item.get("dest_type") in ("city", "region"):
                return str(item["dest_id"])
        return str(results[0]["dest_id"]) if results else None

    async def search(self, q: HotelSearchQuery) -> list[HotelOffer]:
        dest_id = await self._get_dest_id(q.city)
        if not dest_id:
            return []

        params: dict = {
            "dest_id": dest_id,
            "search_type": "CITY",
            "arrival_date": q.checkin.isoformat(),
            "departure_date": q.checkout.isoformat(),
            "adults": str(q.adults),
            "room_qty": str(q.rooms),
            "units": "metric",
            "temperature_unit": "c",
            "languagecode": "ko",
            "currency_code": "KRW",
            "page_number": "1",
        }
        if q.min_rating:
            params["min_review_score"] = str(int(q.min_rating * 2))  # 5점 → 10점 스케일

        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"{self._BASE}/searchHotels",
                params=params,
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()

        return self._parse(data, q)

    def _parse(self, data: dict, q: HotelSearchQuery) -> list[HotelOffer]:
        nights = max(1, (q.checkout - q.checkin).days)
        offers: list[HotelOffer] = []
        hotels = data.get("data", {}).get("hotels", [])
        for item in hotels[:10]:
            try:
                prop = item.get("property", {})
                price_info = item.get("priceBreakdown", {})
                gross = price_info.get("grossPrice", {})
                price_per_night = int(float(gross.get("value", 0)))
                if price_per_night <= 0:
                    continue

                name = prop.get("name", "Unknown Hotel")
                rating = float(prop.get("reviewScore", 0) or 0) / 2  # 10점 → 5점
                review_count = prop.get("reviewCount")
                star = prop.get("propertyClass")  # 1~5
                lat = prop.get("latitude")
                lng = prop.get("longitude")
                photo = (prop.get("photoUrls") or [None])[0]
                hotel_id = str(prop.get("id", ""))

                deeplink = (
                    f"https://www.booking.com/hotel/searchresults.ko.html"
                    f"?ss={normalize_city_for_hotels(q.city)}"
                    f"&checkin={q.checkin.isoformat()}"
                    f"&checkout={q.checkout.isoformat()}"
                    f"&no_rooms={q.rooms}&group_adults={q.adults}"
                )

                offers.append(
                    HotelOffer(
                        id=f"booking_rapidapi:{hotel_id}",
                        name=name,
                        price_per_night_krw=price_per_night,
                        total_price_krw=price_per_night * nights,
                        rating=round(rating, 1) if rating else None,
                        review_count=int(review_count) if review_count else None,
                        star_rating=int(star) if star else None,
                        address=prop.get("wishlistName") or q.city,
                        latitude=float(lat) if lat else None,
                        longitude=float(lng) if lng else None,
                        thumbnail=photo,
                        deeplink=deeplink,
                        affiliate_source="booking",
                        women_floor=False,
                        solo_friendly=bool(rating and rating >= 4.5),
                    )
                )
            except Exception as e:
                logger.debug("booking_rapidapi parse error: %s", e)
        return offers


class BookingProvider(HotelProvider):
    """Booking.com 공식 Affiliate Demand API v2 실연동.

    인증: Basic Auth (affiliate_id:secret) → Bearer 토큰 교환 (캐시 1h)
    엔드포인트: POST /accommodations/search
    공식 문서: https://developers.booking.com/affiliate/

    키 미설정 / 승인 대기 시 RapidApiBookingProvider 또는 Mock이 사용됨.
    """

    name = "booking"
    _AUTH_URL = "https://account.booking.com/oauth2/token"
    _SEARCH_URL = "https://demandapi.booking.com/3.1/accommodations/search"

    def __init__(self, affiliate_id: str, secret: str) -> None:
        self._affiliate_id = affiliate_id
        self._secret = secret
        self._token: str | None = None
        self._token_expires: float = 0.0

    async def _get_token(self) -> str:
        import time

        if self._token and time.time() < self._token_expires - 60:
            return self._token
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._affiliate_id,
                    "client_secret": self._secret,
                },
            )
            resp.raise_for_status()
            j = resp.json()
            self._token = j["access_token"]
            self._token_expires = __import__("time").time() + j.get("expires_in", 3600)
        return self._token  # type: ignore[return-value]

    async def search(self, q: HotelSearchQuery) -> list[HotelOffer]:
        token = await self._get_token()
        city_q = normalize_city_for_hotels(q.city)
        payload = {
            "checkin": q.checkin.isoformat(),
            "checkout": q.checkout.isoformat(),
            "guests": {"adults": q.adults, "rooms": q.rooms},
            "text": city_q,
            "currency": "KRW",
            "rows": 10,
        }
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                self._SEARCH_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Affiliate-Id": self._affiliate_id,
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        return self._parse(data, q)

    def _parse(self, data: dict, q: HotelSearchQuery) -> list[HotelOffer]:
        nights = max(1, (q.checkout - q.checkin).days)
        offers: list[HotelOffer] = []
        for item in data.get("result", [])[:10]:
            try:
                price_per_night = int(item.get("price", {}).get("amount", 0))
                name = item.get("name", "Unknown Hotel")
                rating = float(item.get("review_score", 0) or 0) / 2  # 10점 → 5점
                deeplink = item.get("url") or booking_hotel_url(q)
                lat = item.get("latitude")
                lng = item.get("longitude")
                offers.append(
                    HotelOffer(
                        id=f"booking:{item.get('hotel_id', '')}",
                        name=name,
                        price_per_night_krw=price_per_night,
                        total_price_krw=price_per_night * nights,
                        rating=round(rating, 1) if rating else None,
                        review_count=item.get("review_count"),
                        star_rating=item.get("class"),
                        address=item.get("address", q.city),
                        latitude=float(lat) if lat else None,
                        longitude=float(lng) if lng else None,
                        thumbnail=item.get("main_photo_url"),
                        deeplink=deeplink,
                        affiliate_source="booking",
                        women_floor=bool(item.get("is_family_friendly")),
                        solo_friendly=bool(rating and rating >= 4.5),
                    )
                )
            except Exception as e:
                logger.debug("booking parse error: %s", e)
        return offers


class AgodaProvider(HotelProvider):
    """Agoda Affiliate API 실연동 — 스텁(파트너 승인 후 완성).

    상태: 구조만 준비. Agoda 어필리에이트 승인을 받아 API 키/Site ID와
    공식 문서(요청 파라미터·응답 스키마)를 확보하면 _parse() 본문만 채우면 된다.

    승인 후 해야 할 일:
      1) _BASE / 엔드포인트 경로를 공식 문서에 맞게 확정
      2) search()의 요청 파라미터(체크인/아웃, 통화 KRW, cid=site_id) 매핑
      3) _parse()에서 응답 → HotelOffer 변환 (가격/평점/딥링크)

    승인 전(키 미설정)에는 build_hotel_providers가 이 Provider를 추가하지 않으므로
    호출되지 않는다. 키가 설정돼도 _parse가 빈 결과를 반환하면 Mock으로 폴백된다.

    문서(승인 시 접근): https://partners.agoda.com
    """

    name = "agoda"
    # TODO(agoda): 승인 후 공식 엔드포인트로 교체
    _BASE = "https://affiliateapi7643.agoda.com/affiliateservice"

    def __init__(self, api_key: str, site_id: str) -> None:
        self._key = api_key
        self._site_id = site_id
        # Agoda는 "Authorization: {site_id}:{api_key}" 형식 헤더를 사용(문서 확인 필요)
        self._headers = {
            "Authorization": f"{site_id}:{api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def search(self, q: HotelSearchQuery) -> list[HotelOffer]:
        # 승인/문서 확보 전까지는 호출하지 않는다. 안전하게 빈 결과 반환.
        # (build_hotel_providers가 키 있을 때만 등록하지만, 이중 안전장치)
        if not (self._key and self._site_id):
            return []
        try:
            payload = {
                "criteria": {
                    "additional": {
                        "currency": "KRW",
                        "language": "ko-kr",
                        "maxResult": 10,
                    },
                    "checkInDate": q.checkin.strftime("%Y-%m-%d"),
                    "checkOutDate": q.checkout.strftime("%Y-%m-%d"),
                    "cityName": q.city,
                    "occupancy": {"numberOfAdult": q.adults, "numberOfChildren": 0},
                }
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self._BASE}/lt/v1/search",
                    headers=self._headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
            return self._parse(data, q)
        except Exception as e:
            # 승인 전/문서 불일치 등 모든 오류는 조용히 폴백 (Mock이 채움)
            logger.info("agoda provider not ready / failed: %s", e)
            return []

    def _parse(self, data: dict, q: HotelSearchQuery) -> list[HotelOffer]:
        """Agoda 응답 → HotelOffer. 승인 후 실제 스키마로 채운다.

        아래는 Agoda Long-Tail 검색 응답의 일반적 형태를 가정한 초안이며,
        공식 문서 확보 시 필드명을 검증/교체해야 한다.
        """
        offers: list[HotelOffer] = []
        nights = max(1, (q.checkout - q.checkin).days)
        for item in (data.get("results") or [])[:10]:
            try:
                per_night = int(float(item["dailyRate"]))
                offers.append(
                    HotelOffer(
                        id=f"agoda:{item.get('hotelId', '')}",
                        name=item.get("hotelName", ""),
                        price_per_night_krw=per_night,
                        total_price_krw=per_night * nights,
                        rating=item.get("reviewScore"),
                        review_count=item.get("reviewCount"),
                        star_rating=item.get("starRating"),
                        address=item.get("address", q.city),
                        latitude=item.get("latitude"),
                        longitude=item.get("longitude"),
                        thumbnail=item.get("imageURL"),
                        deeplink=item.get("landingURL", ""),
                        affiliate_source="agoda",
                    )
                )
            except Exception as e:
                logger.debug("agoda parse error: %s", e)
        return offers


# ── Provider 팩토리 — aggregator에서 임포트 ───────────────────────────────────


def build_flight_providers() -> list[FlightProvider]:
    """설정에 따라 실제 Provider + Mock 폴백 목록을 반환."""
    settings = get_settings()
    providers: list[FlightProvider] = []
    # 우선순위 1: Amadeus Self-Service (공식 실시간 GDS)
    if settings.amadeus_api_key and settings.amadeus_api_secret:
        providers.append(
            AmadeusProvider(
                settings.amadeus_api_key,
                settings.amadeus_api_secret,
                settings.amadeus_env,
            )
        )
        logger.info("metasearch_flight_provider=amadeus (live, env=%s)", settings.amadeus_env)
    # 우선순위 2: RapidAPI Skyscanner
    if settings.rapidapi_key:
        providers.append(SkyscannerProvider(settings.rapidapi_key))
        logger.info("metasearch_flight_provider=skyscanner (live)")
    if not providers:
        logger.info("metasearch_flight_provider=mock (no api key)")
    providers.append(MockFlightProvider())  # 항상 폴백
    return providers


def build_hotel_providers() -> list[HotelProvider]:
    """설정에 따라 실제 Provider + Mock 폴백 목록을 반환.

    우선순위:
      1) BookingProvider       — 공식 Affiliate 키 보유 시 (실연동, 최고 품질)
      2) RapidApiBookingProvider — RAPIDAPI_KEY 보유 시 (즉시 사용, 무료 500회/월)
      3) MockHotelProvider     — 키 없음 (참고용 Mock 가격)

    Agoda는 키 보유 시 Booking과 병렬로 추가(aggregator가 가격순 병합).
    """
    settings = get_settings()
    providers: list[HotelProvider] = []

    # 우선순위 1: 공식 Booking.com Affiliate API
    if settings.booking_affiliate_id and settings.booking_affiliate_secret:
        providers.append(
            BookingProvider(settings.booking_affiliate_id, settings.booking_affiliate_secret)
        )
        logger.info("metasearch_hotel_provider=booking_official (live)")

    # 우선순위 2: RapidAPI Booking.com 래퍼 (공식 키 없을 때 자동 활성)
    elif settings.rapidapi_key:
        providers.append(RapidApiBookingProvider(settings.rapidapi_key))
        logger.info("metasearch_hotel_provider=booking_rapidapi (live)")

    # Agoda Affiliate (승인·키 보유 시 병렬 추가). 미준비면 빈 결과 → Mock 폴백.
    if settings.agoda_api_key and settings.agoda_site_id:
        providers.append(AgodaProvider(settings.agoda_api_key, settings.agoda_site_id))
        logger.info("metasearch_hotel_provider+=agoda (live)")

    if not providers:
        logger.info("metasearch_hotel_provider=mock (no api key)")

    providers.append(MockHotelProvider())  # 항상 폴백
    return providers
