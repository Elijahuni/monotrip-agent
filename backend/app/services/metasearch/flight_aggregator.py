"""항공권 메타서치 — 여러 Provider 병렬 호출 후 가격 정렬."""

import asyncio
import logging
import time

from app.schemas.metasearch import FlightOffer, FlightSearchQuery, FlightSearchResult

from .providers import FlightProvider, MockFlightProvider

logger = logging.getLogger(__name__)

# 활성 Provider 목록. 실제 어필리에이트 통합 시 여기에 추가.
_PROVIDERS: list[FlightProvider] = [MockFlightProvider()]

# 단순 인메모리 캐시 — 15분 TTL.
# 키: 검색 파라미터 직렬화. 값: (timestamp, FlightSearchResult)
_CACHE: dict[str, tuple[float, FlightSearchResult]] = {}
_CACHE_TTL = 15 * 60


def _cache_key(q: FlightSearchQuery) -> str:
    return f"{q.from_iata}|{q.to_iata}|{q.depart_date}|{q.return_date}|{q.adults}|{q.cabin}"


async def search_flights(q: FlightSearchQuery) -> FlightSearchResult:
    """모든 활성 Provider를 병렬 호출, 결과를 모아 가격 오름차순 정렬.

    한 Provider가 실패해도 다른 결과는 반환 (best-effort).
    """
    key = _cache_key(q)
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    succeeded: list[str] = []
    failed: list[str] = []
    all_offers: list[FlightOffer] = []

    async def call(p: FlightProvider) -> None:
        try:
            offers = await asyncio.wait_for(p.search(q), timeout=8.0)
            all_offers.extend(offers)
            succeeded.append(p.name)
        except Exception as e:
            logger.warning("Flight provider %s failed: %s", p.name, e)
            failed.append(p.name)

    await asyncio.gather(*[call(p) for p in _PROVIDERS], return_exceptions=False)

    # 가격 오름차순 → 같은 가격이면 더 짧은 비행 시간 우선
    all_offers.sort(key=lambda o: (o.price_krw, o.duration_minutes))

    # 데이터 출처: 실제 어필리에이트 Provider가 1개라도 성공하면 "live"
    data_source = "live" if any(s != "mock" for s in succeeded) else "mock"

    result = FlightSearchResult(
        offers=all_offers,
        providers_succeeded=succeeded,
        providers_failed=failed,
        data_source=data_source,
    )
    _CACHE[key] = (now, result)
    return result
