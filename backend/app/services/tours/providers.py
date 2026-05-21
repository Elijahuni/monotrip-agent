"""투어·티켓 Provider.

현재는 결정론적 Mock Provider만 제공(키 불필요). 추후 Viator/Klook 제휴 API를
LiveTourProvider로 추가하면 build_tour_providers()가 자동 포함하도록 확장한다.
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from urllib.parse import quote

from app.schemas.tours import TourOffer, TourSearchQuery

logger = logging.getLogger(__name__)


def _det_hash(seed: str) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)


# ── 제휴 딥링크 빌더 (검색 URL) ────────────────────────────────────────────────


def _deeplink(source: str, city: str, title: str) -> str:
    q = quote(f"{city} {title}")
    if source == "klook":
        return f"https://www.klook.com/search/?query={q}"
    if source == "kkday":
        return f"https://www.kkday.com/ko/product/productlist?keyword={q}"
    if source == "viator":
        return f"https://www.viator.com/searchResults/all?text={q}"
    return f"https://www.myrealtrip.com/search?q={q}"  # myrealtrip


_CATEGORIES = ["activity", "attraction", "tour", "show", "food", "transport"]
_TITLES = {
    "activity": ["원데이 클래스", "쿠킹 클래스", "스노클링 체험", "ATV 투어"],
    "attraction": ["전망대 입장권", "테마파크 1일권", "박물관 패스", "수족관 티켓"],
    "tour": ["시티 워킹 투어", "근교 당일 투어", "야경 버스 투어", "프라이빗 가이드"],
    "show": ["전통 공연 관람", "디너쇼", "뮤지컬 티켓", "재즈바 입장"],
    "food": ["미식 투어", "야시장 푸드 투어", "스트리트 푸드 클래스", "와이너리 시음"],
    "transport": ["공항 픽업", "교통 패스", "심카드/eSIM", "근교 셔틀"],
}
_SOURCES = ["klook", "kkday", "viator", "myrealtrip"]


def _mock_tour_offers(q: TourSearchQuery) -> list[TourOffer]:
    """검색 파라미터 기반 결정론적 mock — 6~9개 상품."""
    base_seed = f"{q.city}{q.category}{q.travel_date}"
    h = _det_hash(base_seed)
    categories = [q.category] if q.category else _CATEGORIES

    offers: list[TourOffer] = []
    n = 6 + (h % 4)  # 6~9개
    for i in range(n):
        cat = categories[(h + i) % len(categories)]
        titles = _TITLES[cat]
        title = f"{q.city} {titles[(h + i) % len(titles)]}"
        source = _SOURCES[(h + i) % len(_SOURCES)]
        price = int((18_000 + ((h + i * 13) % 120) * 1000) * max(1, q.travelers * 0.9))
        rating = round(4.0 + ((h + i) % 10) / 10, 1)
        offers.append(
            TourOffer(
                id=f"{source}-{h % 100000}-{i}",
                title=title,
                category=cat,
                city=q.city,
                price_krw=price,
                duration_hours=round(1.0 + ((h + i) % 8) * 0.5, 1),
                rating=rating,
                review_count=20 + ((h + i * 7) % 980),
                thumbnail=None,
                instant_confirmation=((h + i) % 2 == 0),
                free_cancellation=((h + i) % 3 == 0),
                deeplink=_deeplink(source, q.city, title),
                affiliate_source=source,
            )
        )
    return offers


class TourProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, q: TourSearchQuery) -> list[TourOffer]: ...


class MockTourProvider(TourProvider):
    """결정론적 시뮬레이션 — 실제 제휴 API 도입 전까지의 stub."""

    name = "mock"

    async def search(self, q: TourSearchQuery) -> list[TourOffer]:
        return _mock_tour_offers(q)


def build_tour_providers() -> list[TourProvider]:
    """활성 Provider 목록. 현재는 Mock만(제휴 키 도입 시 Live 추가)."""
    logger.info("tours_provider=mock (no affiliate api)")
    return [MockTourProvider()]
