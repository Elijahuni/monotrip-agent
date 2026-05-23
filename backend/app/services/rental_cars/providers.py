"""렌터카·보험 Provider.

현재는 결정론적 Mock Provider만 제공(키 불필요). 추후 Rentalcars/Klook 제휴 API를
LiveProvider로 추가하면 build_rental_providers()가 자동 포함하도록 확장한다.
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from urllib.parse import quote

from app.schemas.rental_cars import RentalCarOffer, RentalCarSearchQuery

logger = logging.getLogger(__name__)


def _det_hash(seed: str) -> int:
    return int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)


def _deeplink(source: str, city: str) -> str:
    q = quote(city)
    if source == "rentalcars":
        return f"https://www.rentalcars.com/SearchResults.do?location={q}"
    if source == "klook":
        return f"https://www.klook.com/search/?query={quote(city + ' 렌터카')}"
    if source == "sixt":
        return f"https://www.sixt.com/php/reservation?searchterm={q}"
    return f"https://www.lotterentacar.net/hp/kor/index.do?search={q}"  # lotte


_CLASSES: list[tuple[str, str, int]] = [
    ("economy", "기아 모닝 또는 동급", 4),
    ("compact", "현대 아반떼 또는 동급", 5),
    ("midsize", "현대 쏘나타 또는 동급", 5),
    ("suv", "기아 쏘렌토 또는 동급", 5),
    ("van", "기아 카니발 또는 동급", 9),
    ("luxury", "제네시스 G80 또는 동급", 5),
]
_VENDORS = [
    ("Hertz", "rentalcars"),
    ("Avis", "rentalcars"),
    ("SIXT", "sixt"),
    ("롯데렌터카", "lotte"),
    ("Klook", "klook"),
]
# 보험 수준별 1일 추가요금(원)
_INSURANCE_PRICE = {"none": 0, "basic": 9_000, "full": 22_000}


def _mock_rental_offers(q: RentalCarSearchQuery, rental_days: int) -> list[RentalCarOffer]:
    """검색 파라미터 기반 결정론적 mock — 5~8개 차량."""
    base_seed = f"{q.city}{q.pickup_date}{q.return_date}"
    h = _det_hash(base_seed)

    levels = [q.insurance_level] if q.insurance_level else ["none", "basic", "full"]

    offers: list[RentalCarOffer] = []
    n = 5 + (h % 4)  # 5~8개
    for i in range(n):
        car_class, model, seats = _CLASSES[(h + i) % len(_CLASSES)]
        vendor, source = _VENDORS[(h + i) % len(_VENDORS)]
        level = levels[(h + i) % len(levels)]

        class_base = {
            "economy": 35_000,
            "compact": 45_000,
            "midsize": 60_000,
            "suv": 85_000,
            "van": 110_000,
            "luxury": 180_000,
        }[car_class]
        jitter = ((h + i * 11) % 30) - 15  # ±15%
        per_day = int(class_base * (1 + jitter / 100))
        ins_per_day = _INSURANCE_PRICE[level]
        # 만 25세 미만 영드라이버 할증
        young_surcharge = 8_000 if q.driver_age < 25 else 0
        total = (per_day + ins_per_day + young_surcharge) * rental_days

        offers.append(
            RentalCarOffer(
                id=f"{source}-{h % 100000}-{i}",
                vendor=vendor,
                car_class=car_class,
                car_model=model,
                transmission="auto",
                seats=seats,
                price_per_day_krw=per_day,
                total_price_krw=total,
                insurance_level=level,
                insurance_included=(level != "none"),
                insurance_price_krw=ins_per_day * rental_days,
                free_cancellation=((h + i) % 2 == 0),
                unlimited_mileage=((h + i) % 3 != 0),
                deeplink=_deeplink(source, q.city),
                affiliate_source=source,
            )
        )
    return offers


class RentalProvider(ABC):
    name: str

    @abstractmethod
    async def search(self, q: RentalCarSearchQuery, rental_days: int) -> list[RentalCarOffer]: ...


class MockRentalProvider(RentalProvider):
    """결정론적 시뮬레이션 — 실제 제휴 API 도입 전까지의 stub."""

    name = "mock"

    async def search(self, q: RentalCarSearchQuery, rental_days: int) -> list[RentalCarOffer]:
        return _mock_rental_offers(q, rental_days)


def build_rental_providers() -> list[RentalProvider]:
    """활성 Provider 목록. 현재는 Mock만(제휴 키 도입 시 Live 추가)."""
    logger.info("rental_cars_provider=mock (no affiliate api)")
    return [MockRentalProvider()]
