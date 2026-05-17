"""항공권 가격 알림 잡.

스케줄: 매일 UTC 01:00 (KST 10:00) — 아침 검색 피크 전 미리 조회

실행 흐름:
  1. flight_price_alerts 테이블에서 is_active=True + depart_date >= 오늘인 레코드 조회
  2. 각 구간에 대해 Provider 호출 → 오늘 최저가 획득
  3. flight_price_snapshots 에 스냅샷 적재
  4. 직전 스냅샷 대비 drop_threshold_pct% 이상 하락이면 push 알림 전송
  5. 출발일이 지난 알림은 is_active=False 처리 (만료)

가격 비교 기준:
  직전 30일 평균 대비 현재 최저가 하락률 = (avg - current) / avg * 100
  하락률 >= drop_threshold_pct → 알림 발송
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.price_alert import FlightPriceAlert
from app.models.price_snapshot import FlightPriceSnapshot
from app.models.user import User
from app.schemas.metasearch import FlightSearchQuery
from app.services.metasearch.flight_aggregator import search_flights
from app.services.push_notification_service import PushMessage, send_push_notifications

logger = logging.getLogger(__name__)

# 1건 조회 실패 시 다음 건으로 계속 (best-effort)
# 전체 잡 실패 방지를 위해 개별 오류는 로그만 남김


async def run_price_alert_job() -> None:
    """APScheduler 또는 직접 호출 진입점."""
    today = date.today()
    logger.info("price_alert_job_started date=%s", today.isoformat())

    sent = 0
    expired = 0
    errors = 0

    async with AsyncSessionLocal() as db:
        alerts = await _load_active_alerts(db, today)
        logger.info("price_alert_job alerts_count=%d", len(alerts))

        push_messages: list[PushMessage] = []

        for alert in alerts:
            # 출발일 경과 → 비활성화
            if alert.depart_date < today:
                await _deactivate(db, alert.id)
                expired += 1
                continue

            try:
                min_price, avg_30d = await _fetch_prices(db, alert)
                if min_price is None:
                    continue

                await _save_snapshot(db, alert, min_price)

                msg = await _check_and_build_message(db, alert, min_price, avg_30d)
                if msg:
                    push_messages.append(msg)
                    await _mark_alerted(db, alert, min_price)
                    sent += 1

            except Exception as e:
                logger.warning("price_alert error alert_id=%d: %s", alert.id, e)
                errors += 1

        await db.commit()

    if push_messages:
        result = await send_push_notifications(push_messages)
        logger.info("price_alert_push sent=%d failed=%d", result.sent, result.failed)

    logger.info(
        "price_alert_job_done sent=%d expired=%d errors=%d",
        sent,
        expired,
        errors,
    )


async def _load_active_alerts(db: AsyncSession, today: date) -> list[FlightPriceAlert]:
    stmt = (
        select(FlightPriceAlert)
        .where(FlightPriceAlert.is_active.is_(True))
        .where(FlightPriceAlert.depart_date >= today)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _fetch_prices(db: AsyncSession, alert: FlightPriceAlert) -> tuple[int | None, int | None]:
    """Provider에서 오늘 최저가 조회 + DB에서 직전 30일 평균가 조회."""
    q = FlightSearchQuery(
        from_iata=alert.from_iata,
        to_iata=alert.to_iata,
        depart_date=alert.depart_date,
        return_date=alert.return_date,
        adults=alert.adults,
        cabin=alert.cabin,
    )
    result = await search_flights(q)
    if not result.offers:
        return None, None
    min_price = min(o.price_krw for o in result.offers)

    # 직전 30일 스냅샷 평균
    from datetime import timedelta

    from sqlalchemy import func

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    avg_stmt = (
        select(func.avg(FlightPriceSnapshot.min_price_krw))
        .where(FlightPriceSnapshot.from_iata == alert.from_iata)
        .where(FlightPriceSnapshot.to_iata == alert.to_iata)
        .where(FlightPriceSnapshot.depart_date == alert.depart_date)
        .where(FlightPriceSnapshot.captured_at >= cutoff)
    )
    avg_result = await db.execute(avg_stmt)
    avg_val = avg_result.scalar()
    avg_30d = int(avg_val) if avg_val else None

    return min_price, avg_30d


async def _save_snapshot(db: AsyncSession, alert: FlightPriceAlert, min_price: int) -> None:
    snapshot = FlightPriceSnapshot(
        from_iata=alert.from_iata,
        to_iata=alert.to_iata,
        depart_date=alert.depart_date,
        return_date=alert.return_date,
        cabin=alert.cabin,
        min_price_krw=min_price,
        sample_size=1,
    )
    db.add(snapshot)
    await db.flush()


async def _check_and_build_message(
    db: AsyncSession,
    alert: FlightPriceAlert,
    current_price: int,
    avg_30d: int | None,
) -> PushMessage | None:
    """가격 하락 조건 충족 시 PushMessage 반환, 아니면 None."""
    # 비교 기준: 30일 평균이 있으면 평균 대비, 없으면 마지막 알림 가격 대비
    reference = avg_30d or alert.last_alerted_price_krw
    if reference is None or reference <= 0:
        return None  # 비교 기준 없음 — 첫 스냅샷이면 패스

    drop_pct = (reference - current_price) / reference * 100
    if drop_pct < alert.drop_threshold_pct:
        return None

    # 같은 가격으로 이미 알림 보낸 경우 중복 방지
    if alert.last_alerted_price_krw and alert.last_alerted_price_krw <= current_price:
        return None

    # 사용자 푸시 토큰 조회
    user_stmt = select(User.expo_push_token).where(User.id == alert.user_id)
    token_result = await db.execute(user_stmt)
    token = token_result.scalar()
    if not token:
        return None

    route = f"{alert.from_iata} → {alert.to_iata}"
    price_fmt = f"{current_price:,}원"
    drop_fmt = f"{drop_pct:.0f}%"

    return PushMessage(
        to=token,
        title=f"✈️ {route} 항공권 가격 하락!",
        body=f"{alert.depart_date.strftime('%m/%d')} 출발 최저가 {price_fmt} ({drop_fmt} 인하)",
        data={
            "type": "price_alert",
            "from_iata": alert.from_iata,
            "to_iata": alert.to_iata,
            "depart_date": alert.depart_date.isoformat(),
            "price_krw": current_price,
        },
    )


async def _mark_alerted(db: AsyncSession, alert: FlightPriceAlert, price: int) -> None:
    stmt = (
        update(FlightPriceAlert)
        .where(FlightPriceAlert.id == alert.id)
        .values(
            last_alerted_price_krw=price,
            last_alerted_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
    )
    await db.execute(stmt)


async def _deactivate(db: AsyncSession, alert_id: int) -> None:
    stmt = update(FlightPriceAlert).where(FlightPriceAlert.id == alert_id).values(is_active=False)
    await db.execute(stmt)
