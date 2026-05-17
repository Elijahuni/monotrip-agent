"""Phase 2 메타서치 라우트 — 항공/숙소 가격비교."""

from __future__ import annotations

import logging
import statistics
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request

from app.database import AsyncSessionLocal
from app.dependencies.auth import get_current_user
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.price_snapshot import FlightPriceSnapshot, HotelPriceSnapshot
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.metasearch import (
    FlightSearchQuery,
    FlightSearchResult,
    HotelSearchQuery,
    HotelSearchResult,
)
from app.schemas.metasearch import PriceTrend
from app.services.metasearch import search_flights, search_hotels
from app.services.metasearch.price_trend import analyze_flight_price, analyze_hotel_price

router = APIRouter(prefix="/metasearch", tags=["metasearch"])
logger = logging.getLogger(__name__)


# ── BackgroundTasks: 가격 스냅샷 적재 (검색 응답 차단하지 않음) ──────────────


async def _persist_flight_snapshot(q: FlightSearchQuery, result: FlightSearchResult) -> None:
    if not result.offers:
        return
    prices = [o.price_krw for o in result.offers]
    try:
        async with AsyncSessionLocal() as db:
            snap = FlightPriceSnapshot(
                from_iata=q.from_iata.upper(),
                to_iata=q.to_iata.upper(),
                depart_date=q.depart_date,
                return_date=q.return_date,
                cabin=q.cabin,
                min_price_krw=min(prices),
                median_price_krw=int(statistics.median(prices)),
                sample_size=len(prices),
            )
            db.add(snap)
            await db.commit()
    except Exception as e:
        # 적재 실패는 검색 결과에 영향 없음
        logger.warning("Flight snapshot persist failed: %s", e)


async def _persist_hotel_snapshot(q: HotelSearchQuery, result: HotelSearchResult) -> None:
    if not result.offers:
        return
    prices = [o.price_per_night_krw for o in result.offers]
    try:
        async with AsyncSessionLocal() as db:
            snap = HotelPriceSnapshot(
                city=q.city,
                checkin=q.checkin,
                checkout=q.checkout,
                min_price_per_night_krw=min(prices),
                median_price_per_night_krw=int(statistics.median(prices)),
                sample_size=len(prices),
            )
            db.add(snap)
            await db.commit()
    except Exception as e:
        logger.warning("Hotel snapshot persist failed: %s", e)


# ── 항공 ─────────────────────────────────────────────────────────────────────


@router.get("/flights", response_model=ApiResponse[FlightSearchResult])
@limiter.limit("30/hour")
async def get_flights(
    request: Request,
    background: BackgroundTasks,
    from_iata: str = Query(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$"),
    to_iata: str = Query(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$"),
    depart_date: date = Query(description="YYYY-MM-DD"),
    return_date: date | None = Query(default=None, description="왕복 시 (옵션)"),
    adults: int = Query(default=1, ge=1, le=9),
    cabin: str = Query(default="economy", pattern=r"^(economy|premium_economy|business|first)$"),
    db: DbSession = None,  # type: ignore[assignment]
    _user: User = Depends(get_current_user),
) -> ApiResponse[FlightSearchResult]:
    q = FlightSearchQuery(
        from_iata=from_iata.upper(),
        to_iata=to_iata.upper(),
        depart_date=depart_date,
        return_date=return_date,
        adults=adults,
        cabin=cabin,  # type: ignore[arg-type]
    )
    result = await search_flights(q)

    # 가격 추세 — 현재 스냅샷 적재 전에 분석 (자기 자신을 평균에 포함하지 않도록)
    if result.offers and db is not None:
        try:
            tr = await analyze_flight_price(
                db,
                from_iata=q.from_iata,
                to_iata=q.to_iata,
                depart_date=q.depart_date,
                current_min=min(o.price_krw for o in result.offers),
            )
            result.trend = PriceTrend(**tr.model_dump())
        except Exception as e:
            logger.warning("Flight trend analysis failed: %s", e)

    # 응답 차단 없이 가격 스냅샷 적재
    background.add_task(_persist_flight_snapshot, q, result)
    return ApiResponse(data=result)


# ── 숙소 ─────────────────────────────────────────────────────────────────────


@router.get("/hotels", response_model=ApiResponse[HotelSearchResult])
@limiter.limit("30/hour")
async def get_hotels(
    request: Request,
    background: BackgroundTasks,
    city: str = Query(min_length=1, max_length=50),
    checkin: date = Query(description="YYYY-MM-DD"),
    checkout: date = Query(description="YYYY-MM-DD"),
    adults: int = Query(default=2, ge=1, le=8),
    rooms: int = Query(default=1, ge=1, le=4),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    women_friendly_only: bool = Query(default=False),
    db: DbSession = None,  # type: ignore[assignment]
    _user: User = Depends(get_current_user),
) -> ApiResponse[HotelSearchResult]:
    q = HotelSearchQuery(
        city=city,
        checkin=checkin,
        checkout=checkout,
        adults=adults,
        rooms=rooms,
        min_rating=min_rating,
        women_friendly_only=women_friendly_only,
    )
    result = await search_hotels(q)

    if result.offers and db is not None:
        try:
            tr = await analyze_hotel_price(
                db,
                city=q.city,
                checkin=q.checkin,
                current_min_per_night=min(o.price_per_night_krw for o in result.offers),
            )
            result.trend = PriceTrend(**tr.model_dump())
        except Exception as e:
            logger.warning("Hotel trend analysis failed: %s", e)

    background.add_task(_persist_hotel_snapshot, q, result)
    return ApiResponse(data=result)
