"""가격 히스토리 분석 — 현재 가격이 살 때인지 판정.

축적된 snapshots를 7/30일 윈도우로 집계해 현재 가격과 비교한다.
샘플 부족(<5)이면 'insufficient_data' 반환.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_snapshot import FlightPriceSnapshot, HotelPriceSnapshot

logger = logging.getLogger(__name__)

PriceSignal = Literal["buy_now", "cheap", "average", "expensive", "insufficient_data"]


class PriceTrendResult(BaseModel):
    signal: PriceSignal
    current_min: int
    avg_7d: int | None = None
    avg_30d: int | None = None
    sample_count_30d: int = 0
    message: str  # 한국어 안내


def _classify(
    current: int, avg_7d: int | None, avg_30d: int | None, samples: int
) -> tuple[PriceSignal, str]:
    if samples < 5:
        return "insufficient_data", "가격 데이터가 모이는 중이에요"

    # 우선 7일 평균, 없으면 30일 평균 기준
    baseline = avg_7d or avg_30d
    if baseline is None:
        return "insufficient_data", "평균을 계산할 수 없어요"

    ratio = current / baseline
    if ratio <= 0.85:
        return "buy_now", f"평균보다 {int((1 - ratio) * 100)}% 저렴해요 · 지금 살 때!"
    if ratio <= 0.95:
        return "cheap", f"평균보다 {int((1 - ratio) * 100)}% 저렴해요"
    if ratio <= 1.10:
        return "average", "평균적인 가격이에요"
    return "expensive", f"평균보다 {int((ratio - 1) * 100)}% 비싸요 · 좀 더 기다려도 좋아요"


async def analyze_flight_price(
    db: AsyncSession,
    *,
    from_iata: str,
    to_iata: str,
    depart_date: date,
    current_min: int,
) -> PriceTrendResult:
    """동일 노선·동일 출발일 스냅샷을 7/30일 윈도우로 평균.

    같은 depart_date 키만 비교하므로 '같은 여행에 대한 시세 추이' 의미.
    """
    now = datetime.utcnow()
    win_7 = now - timedelta(days=7)
    win_30 = now - timedelta(days=30)

    base = (
        select(FlightPriceSnapshot)
        .where(FlightPriceSnapshot.from_iata == from_iata.upper())
        .where(FlightPriceSnapshot.to_iata == to_iata.upper())
        .where(FlightPriceSnapshot.depart_date == depart_date)
    )

    avg_7d_q = await db.execute(
        select(func.avg(FlightPriceSnapshot.min_price_krw)).select_from(
            base.where(FlightPriceSnapshot.captured_at >= win_7).subquery()
        )
    )
    avg_30d_q = await db.execute(
        select(
            func.avg(FlightPriceSnapshot.min_price_krw),
            func.count(FlightPriceSnapshot.id),
        ).select_from(base.where(FlightPriceSnapshot.captured_at >= win_30).subquery())
    )

    avg_7d_val = avg_7d_q.scalar()
    row = avg_30d_q.first()
    avg_30d_val, sample_count = (row[0], row[1]) if row else (None, 0)

    avg_7d = int(avg_7d_val) if avg_7d_val is not None else None
    avg_30d = int(avg_30d_val) if avg_30d_val is not None else None

    signal, message = _classify(current_min, avg_7d, avg_30d, sample_count or 0)
    return PriceTrendResult(
        signal=signal,
        current_min=current_min,
        avg_7d=avg_7d,
        avg_30d=avg_30d,
        sample_count_30d=sample_count or 0,
        message=message,
    )


async def analyze_hotel_price(
    db: AsyncSession,
    *,
    city: str,
    checkin: date,
    current_min_per_night: int,
) -> PriceTrendResult:
    """동일 도시·체크인일 스냅샷 기반 호텔 가격 추세."""
    now = datetime.utcnow()
    win_7 = now - timedelta(days=7)
    win_30 = now - timedelta(days=30)

    base = (
        select(HotelPriceSnapshot)
        .where(HotelPriceSnapshot.city == city)
        .where(HotelPriceSnapshot.checkin == checkin)
    )

    avg_7d_q = await db.execute(
        select(func.avg(HotelPriceSnapshot.min_price_per_night_krw)).select_from(
            base.where(HotelPriceSnapshot.captured_at >= win_7).subquery()
        )
    )
    avg_30d_q = await db.execute(
        select(
            func.avg(HotelPriceSnapshot.min_price_per_night_krw),
            func.count(HotelPriceSnapshot.id),
        ).select_from(base.where(HotelPriceSnapshot.captured_at >= win_30).subquery())
    )

    avg_7d_val = avg_7d_q.scalar()
    row = avg_30d_q.first()
    avg_30d_val, sample_count = (row[0], row[1]) if row else (None, 0)

    avg_7d = int(avg_7d_val) if avg_7d_val is not None else None
    avg_30d = int(avg_30d_val) if avg_30d_val is not None else None

    signal, message = _classify(current_min_per_night, avg_7d, avg_30d, sample_count or 0)
    return PriceTrendResult(
        signal=signal,
        current_min=current_min_per_night,
        avg_7d=avg_7d,
        avg_30d=avg_30d,
        sample_count_30d=sample_count or 0,
        message=message,
    )
