"""Agoda 호텔 Provider 스텁 테스트.

승인 전 단계이므로 네트워크 호출은 검증하지 않는다. 스텁이
(1) 키 없으면 호출하지 않고 빈 결과를 반환하고,
(2) _parse가 빈/오류 응답에서도 예외 없이 폴백(빈 리스트)하며,
(3) 가정 스키마 응답을 HotelOffer로 변환하는지 확인한다.
승인 후 _parse가 실제 스키마로 채워지면 이 테스트의 샘플만 교체하면 된다.
"""

from datetime import date

import pytest

from app.schemas.metasearch import HotelSearchQuery
from app.services.metasearch.providers import AgodaProvider


def _query() -> HotelSearchQuery:
    return HotelSearchQuery(city="도쿄", checkin=date(2026, 9, 1), checkout=date(2026, 9, 3))


@pytest.mark.asyncio
async def test_search_returns_empty_without_keys():
    provider = AgodaProvider("", "")
    assert await provider.search(_query()) == []


def test_parse_handles_empty_and_malformed():
    provider = AgodaProvider("k", "sid")
    assert provider._parse({}, _query()) == []
    assert provider._parse({"results": [{"bad": "shape"}]}, _query()) == []


def test_parse_maps_assumed_schema():
    provider = AgodaProvider("k", "sid")
    sample = {
        "results": [
            {
                "hotelId": 123,
                "hotelName": "Tokyo Bay Hotel",
                "dailyRate": "98000",
                "reviewScore": 8.6,
                "reviewCount": 1200,
                "starRating": 4,
                "address": "Minato, Tokyo",
                "landingURL": "https://www.agoda.com/partners/...",
            }
        ]
    }
    offers = provider._parse(sample, _query())  # 2박
    assert len(offers) == 1
    o = offers[0]
    assert o.id == "agoda:123"
    assert o.price_per_night_krw == 98000
    assert o.total_price_krw == 196000  # 98000 × 2박
    assert o.affiliate_source == "agoda"
    assert o.deeplink.startswith("http")
