"""Amadeus 항공 Provider 파싱 단위 테스트 (네트워크 없이 _parse 검증).

실제 OAuth/HTTP 호출은 키가 있어야 하므로, 대표 응답 샘플로 파싱 로직만 검증한다.
"""

from datetime import date

import pytest

from app.schemas.metasearch import FlightSearchQuery
from app.services.metasearch.providers import (
    AmadeusProvider,
    _iso8601_duration_to_minutes,
)


@pytest.mark.parametrize(
    "iso, minutes",
    [
        ("PT5H30M", 330),
        ("PT45M", 45),
        ("PT2H", 120),
        ("", 0),
        ("invalid", 0),
    ],
)
def test_iso8601_duration_to_minutes(iso, minutes):
    assert _iso8601_duration_to_minutes(iso) == minutes


def _sample_response() -> dict:
    return {
        "data": [
            {
                "id": "1",
                "price": {"total": "285000.00", "currency": "KRW"},
                "itineraries": [
                    {
                        "duration": "PT2H25M",
                        "segments": [
                            {
                                "carrierCode": "KE",
                                "number": "703",
                                "departure": {"iataCode": "ICN", "at": "2026-09-01T09:00:00"},
                                "arrival": {"iataCode": "NRT", "at": "2026-09-01T11:25:00"},
                                "duration": "PT2H25M",
                            }
                        ],
                    }
                ],
            },
            {
                "id": "2",
                "price": {"total": "210000.50", "currency": "KRW"},
                "itineraries": [
                    {
                        "duration": "PT5H10M",
                        "segments": [
                            {
                                "carrierCode": "OZ",
                                "number": "102",
                                "departure": {"iataCode": "ICN", "at": "2026-09-01T07:00:00"},
                                "arrival": {"iataCode": "KIX", "at": "2026-09-01T09:00:00"},
                                "duration": "PT2H",
                            },
                            {
                                "carrierCode": "OZ",
                                "number": "350",
                                "departure": {"iataCode": "KIX", "at": "2026-09-01T10:10:00"},
                                "arrival": {"iataCode": "NRT", "at": "2026-09-01T12:10:00"},
                                "duration": "PT2H",
                            },
                        ],
                    }
                ],
            },
        ]
    }


def test_parse_builds_offers():
    provider = AmadeusProvider("k", "s", "test")
    q = FlightSearchQuery(from_iata="ICN", to_iata="NRT", depart_date=date(2026, 9, 1))
    offers = provider._parse(_sample_response(), q)

    assert len(offers) == 2

    direct = next(o for o in offers if o.id == "amadeus:1")
    assert direct.price_krw == 285000
    assert direct.airline == "KE"
    assert direct.stops == 0
    assert direct.duration_minutes == 145
    assert direct.affiliate_source == "amadeus"
    assert direct.deeplink.startswith("http")
    assert len(direct.segments) == 1

    layover = next(o for o in offers if o.id == "amadeus:2")
    assert layover.stops == 1  # 2 segments → 1 stop
    assert layover.price_krw == 210000
    assert layover.depart_time.hour == 7
    assert layover.arrive_time.hour == 12


def test_parse_skips_malformed_offer():
    provider = AmadeusProvider("k", "s", "test")
    q = FlightSearchQuery(from_iata="ICN", to_iata="NRT", depart_date=date(2026, 9, 1))
    bad = {"data": [{"id": "x", "price": {}, "itineraries": []}]}
    # 예외 없이 빈 리스트 반환 (개별 오류는 건너뜀)
    assert provider._parse(bad, q) == []
