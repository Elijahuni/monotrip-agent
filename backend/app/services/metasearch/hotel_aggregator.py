"""숙소 메타서치 — Provider 병렬 호출 + 여성 친화 필터."""
import asyncio
import logging
import time

from app.schemas.metasearch import HotelOffer, HotelSearchQuery, HotelSearchResult

from .providers import HotelProvider, MockHotelProvider

logger = logging.getLogger(__name__)

_PROVIDERS: list[HotelProvider] = [MockHotelProvider()]
_CACHE: dict[str, tuple[float, HotelSearchResult]] = {}
_CACHE_TTL = 15 * 60


def _cache_key(q: HotelSearchQuery) -> str:
    return f"{q.city}|{q.checkin}|{q.checkout}|{q.adults}|{q.rooms}|{q.min_rating}|{q.women_friendly_only}"


def _filter_women_friendly(offers: list[HotelOffer]) -> list[HotelOffer]:
    """여성 친화 필터: women_floor=True 또는 (solo_friendly=True AND rating>=4.5)."""
    out = []
    for o in offers:
        if o.women_floor:
            out.append(o)
        elif o.solo_friendly and (o.rating or 0) >= 4.5:
            out.append(o)
    return out


async def search_hotels(q: HotelSearchQuery) -> HotelSearchResult:
    key = _cache_key(q)
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    succeeded: list[str] = []
    failed: list[str] = []
    all_offers: list[HotelOffer] = []

    async def call(p: HotelProvider) -> None:
        try:
            offers = await asyncio.wait_for(p.search(q), timeout=8.0)
            all_offers.extend(offers)
            succeeded.append(p.name)
        except Exception as e:
            logger.warning("Hotel provider %s failed: %s", p.name, e)
            failed.append(p.name)

    await asyncio.gather(*[call(p) for p in _PROVIDERS], return_exceptions=False)

    # 필터 적용
    if q.min_rating is not None:
        all_offers = [o for o in all_offers if (o.rating or 0) >= q.min_rating]
    if q.women_friendly_only:
        all_offers = _filter_women_friendly(all_offers)

    # 정렬: 1박당 가격 오름차순
    all_offers.sort(key=lambda o: o.price_per_night_krw)

    data_source = "live" if any(s != "mock" for s in succeeded) else "mock"

    result = HotelSearchResult(
        offers=all_offers,
        providers_succeeded=succeeded,
        providers_failed=failed,
        data_source=data_source,
    )
    _CACHE[key] = (now, result)
    return result
