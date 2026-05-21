"""투어·티켓 메타서치 — 여러 Provider 병렬 호출 후 가격 정렬."""

from __future__ import annotations

import asyncio
import logging
import time

from app.schemas.tours import TourOffer, TourSearchQuery, TourSearchResult

from .providers import TourProvider, build_tour_providers

logger = logging.getLogger(__name__)

_PROVIDERS: list[TourProvider] = build_tour_providers()

_CACHE: dict[str, tuple[float, TourSearchResult]] = {}
_CACHE_TTL = 15 * 60


def _cache_key(q: TourSearchQuery) -> str:
    return f"{q.city}|{q.category}|{q.travel_date}|{q.travelers}"


async def search_tours(q: TourSearchQuery) -> TourSearchResult:
    """모든 활성 Provider를 병렬 호출, 결과를 가격 오름차순 정렬(best-effort)."""
    key = _cache_key(q)
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    succeeded: list[str] = []
    failed: list[str] = []
    all_offers: list[TourOffer] = []

    async def call(p: TourProvider) -> None:
        try:
            offers = await asyncio.wait_for(p.search(q), timeout=8.0)
            all_offers.extend(offers)
            succeeded.append(p.name)
        except Exception as e:
            logger.warning("Tour provider %s failed: %s", p.name, e)
            failed.append(p.name)

    await asyncio.gather(*[call(p) for p in _PROVIDERS])

    all_offers.sort(key=lambda o: o.price_krw)

    data_source = "live" if any(s != "mock" for s in succeeded) else "mock"
    result = TourSearchResult(
        offers=all_offers,
        providers_succeeded=succeeded,
        providers_failed=failed,
        data_source=data_source,
    )
    _CACHE[key] = (now, result)
    return result


__all__ = ["search_tours"]
