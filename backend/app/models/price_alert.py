"""사용자 항공권 가격 알림 구독 모델."""

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FlightPriceAlert(Base):
    """사용자가 특정 항공편 구간·날짜를 '관심' 등록한 레코드.

    매일 price_alert 잡이 실행되어:
    1. 오늘 최저가 조회 (Provider 호출)
    2. 직전 스냅샷 대비 DROP_THRESHOLD 이상 하락 시 push 알림 전송
    3. FlightPriceSnapshot 에 새 스냅샷 적재
    """

    __tablename__ = "flight_price_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # 구간 정보
    from_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    to_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    depart_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cabin: Mapped[str] = mapped_column(String(20), nullable=False, default="economy")
    adults: Mapped[int] = mapped_column(nullable=False, default=1)

    # 알림 기준
    # 직전 최저가 대비 DROP_THRESHOLD(%) 이상 하락 시 알림 (기본 10%)
    drop_threshold_pct: Mapped[int] = mapped_column(nullable=False, default=10)

    # 마지막으로 알림 보낸 가격 (알림 중복 방지)
    last_alerted_price_krw: Mapped[int | None] = mapped_column(nullable=True)
    last_alerted_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # 활성 여부 — 출발일 지나면 잡에서 자동 비활성화
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "from_iata", "to_iata", "depart_date", "cabin"),
        Index("ix_flight_alert_active", "is_active"),
        Index("ix_flight_alert_user", "user_id"),
    )
