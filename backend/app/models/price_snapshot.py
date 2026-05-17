"""검색마다 최저가 스냅샷을 적재. Phase 3 시세 예측 모델의 학습 데이터."""

from datetime import date, datetime

from sqlalchemy import Date, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FlightPriceSnapshot(Base):
    __tablename__ = "flight_price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    from_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    to_iata: Mapped[str] = mapped_column(String(3), nullable=False)
    depart_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cabin: Mapped[str] = mapped_column(String(20), nullable=False, default="economy")

    min_price_krw: Mapped[int] = mapped_column(nullable=False)
    median_price_krw: Mapped[int | None] = mapped_column(nullable=True)
    sample_size: Mapped[int] = mapped_column(nullable=False, default=0)
    captured_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_flight_snapshot_route_depart", "from_iata", "to_iata", "depart_date"),
        Index("ix_flight_snapshot_captured_at", "captured_at"),
    )


class HotelPriceSnapshot(Base):
    __tablename__ = "hotel_price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    checkin: Mapped[date] = mapped_column(Date, nullable=False)
    checkout: Mapped[date] = mapped_column(Date, nullable=False)

    min_price_per_night_krw: Mapped[int] = mapped_column(nullable=False)
    median_price_per_night_krw: Mapped[int | None] = mapped_column(nullable=True)
    sample_size: Mapped[int] = mapped_column(nullable=False, default=0)
    captured_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_hotel_snapshot_city_checkin", "city", "checkin"),
        Index("ix_hotel_snapshot_captured_at", "captured_at"),
    )
