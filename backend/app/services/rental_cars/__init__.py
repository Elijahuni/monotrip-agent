"""렌터카·보험 메타서치 — 여러 Provider 병렬 호출 후 가격 정렬."""

from __future__ import annotations

import asyncio
import logging
import time

from fastapi import HTTPException, status

from app.schemas.rental_cars import (
    RentalCarOffer,
    RentalCarSearchQuery,
    RentalCarSearchResult,
)

from .providers import RentalProvider, build_rental_providers

logger = logging.getLogger(__name__)

_PROVIDERS: list[RentalProvider] = build_rental_providers()

_CACHE: dict[str, tuple[float, RentalCarSearchResult]] = {}
_CACHE_TTL = 15 * 60


def _cache_key(q: RentalCarSearchQuery) -> str:
    return f"{q.city}|{q.pickup_date}|{q.return_date}|{q.driver_age}|{q.insurance_level}"


async def search_rental_cars(q: RentalCarSearchQuery) -> RentalCarSearchResult:
    """모든 활성 Provider를 병렬 호출, 결과를 가격 오름차순 정렬(best-effort)."""
    rental_days = (q.return_date - q.pickup_date).days
    if rental_days < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="반납일은 대여일보다 이후여야 합니다.",
        )

    key = _cache_key(q)
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    succeeded: list[str] = []
    failed: list[str] = []
    all_offers: list[RentalCarOffer] = []

    async def call(p: RentalProvider) -> None:
        try:
            offers = await asyncio.wait_for(p.search(q, rental_days), timeout=8.0)
            all_offers.extend(offers)
            succeeded.append(p.name)
        except Exception as e:
            logger.warning("Rental provider %s failed: %s", p.name, e)
            failed.append(p.name)

    await asyncio.gather(*[call(p) for p in _PROVIDERS])

    all_offers.sort(key=lambda o: o.total_price_krw)

    data_source = "live" if any(s != "mock" for s in succeeded) else "mock"
    result = RentalCarSearchResult(
        offers=all_offers,
        providers_succeeded=succeeded,
        providers_failed=failed,
        rental_days=rental_days,
        data_source=data_source,
    )
    _CACHE[key] = (now, result)
    return result


__all__ = ["search_rental_cars"]
