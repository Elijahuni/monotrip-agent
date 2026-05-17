"""APScheduler 기반 D-day 여행 푸시 알림 스케줄러.

실행 시점: 매일 UTC 23:00 (KST 08:00 다음날 아침)
  - D-7, D-3, D-1: 출발 N일 전 알림
  - D-0: 출발 당일 알림

DB 쿼리 전략:
  trips.start_date = target_date AND users.expo_push_token IS NOT NULL
  → 해당 사용자에게 알림 전송
  → DeviceNotRegistered 에러 발생 시 토큰 자동 무효화
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.trip import Trip
from app.models.user import User
from app.services.push_notification_service import PushMessage, send_push_notifications

logger = logging.getLogger(__name__)

# ── 알림 템플릿 ───────────────────────────────────────────────────────────────
# key = 출발까지 남은 일수 (0 = 당일)

_TEMPLATES: dict[int, dict[str, str]] = {
    7: {
        "title": "✈️ 여행 준비 알림",
        "body": "{title} 출발 7일 전! 체크리스트 확인해보세요.",
    },
    3: {
        "title": "🗺 여행 D-3",
        "body": "{title} 출발 3일 전! 일정을 최종 확인하세요.",
    },
    1: {
        "title": "🎒 내일 출발!",
        "body": "{title} 내일 출발이에요! 준비물 마지막 체크!",
    },
    0: {
        "title": "🎉 오늘 출발!",
        "body": "오늘 {title} 출발일이에요! 즐거운 여행 되세요.",
    },
}


# ── 스케줄러 인스턴스 ─────────────────────────────────────────────────────────

_scheduler = AsyncIOScheduler(timezone="UTC")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler


def setup_scheduler(enabled: bool = True) -> None:
    """스케줄러에 잡을 등록한다. enabled=False면 잡 미등록 (테스트/로컬 용)."""
    if not enabled:
        logger.info("notification_scheduler_disabled")
        return

    _scheduler.add_job(
        send_daily_trip_reminders,
        trigger="cron",
        hour=23,  # UTC 23:00 = KST 08:00 (다음날)
        minute=0,
        id="daily_trip_reminders",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # 항공권 가격 알림 — 매일 UTC 01:00 (KST 10:00)
    from app.services.jobs.price_alert import run_price_alert_job

    _scheduler.add_job(
        run_price_alert_job,
        trigger="cron",
        hour=1,
        minute=0,
        id="flight_price_alerts",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("notification_scheduler_registered")


async def send_daily_trip_reminders() -> None:
    """매일 실행: D-7/D-3/D-1/D-0 해당 여행의 사용자에게 알림 전송."""
    today = date.today()
    logger.info("trip_reminder_job_started", date=today.isoformat())

    total_sent = 0
    total_failed = 0
    invalid_tokens: list[str] = []

    async with AsyncSessionLocal() as db:
        for days_offset, template in _TEMPLATES.items():
            target_date = today + timedelta(days=days_offset)
            messages = await _build_messages(db, target_date, template)

            if not messages:
                continue

            result = await send_push_notifications(messages)
            total_sent += result.sent
            total_failed += result.failed
            if result.invalid_tokens:
                invalid_tokens.extend(result.invalid_tokens)

            logger.info(
                "trip_reminder_sent",
                days_offset=days_offset,
                target_date=target_date.isoformat(),
                count=len(messages),
                sent=result.sent,
            )

        # 무효화된 토큰 일괄 제거 (DeviceNotRegistered)
        if invalid_tokens:
            await _invalidate_tokens(db, invalid_tokens)
            await db.commit()

    logger.info(
        "trip_reminder_job_done",
        total_sent=total_sent,
        total_failed=total_failed,
        invalidated=len(invalid_tokens),
    )


async def _build_messages(
    db: AsyncSession,
    target_date: date,
    template: dict[str, str],
) -> list[PushMessage]:
    """target_date에 출발하는 여행 목록 조회 + 메시지 생성."""
    stmt = (
        select(Trip.title, Trip.id, User.expo_push_token)
        .join(User, User.id == Trip.user_id)
        .where(Trip.start_date == target_date)
        .where(User.expo_push_token.is_not(None))
    )
    result = await db.execute(stmt)
    rows = result.all()

    messages = []
    for title, trip_id, token in rows:
        messages.append(
            PushMessage(
                to=token,  # type: ignore[arg-type]
                title=template["title"],
                body=template["body"].format(title=title),
                data={"tripId": trip_id, "type": "trip_reminder"},
            )
        )
    return messages


async def _invalidate_tokens(db: AsyncSession, tokens: list[str]) -> None:
    """DeviceNotRegistered 토큰을 users 테이블에서 NULL로 초기화한다."""
    from sqlalchemy import update

    stmt = update(User).where(User.expo_push_token.in_(tokens)).values(expo_push_token=None)
    await db.execute(stmt)
    logger.info("tokens_invalidated count=%d", len(tokens))
