from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._vector_type import CompatibleVector

if TYPE_CHECKING:
    from app.models.trip import Trip


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    visit_order: Mapped[int] = mapped_column(nullable=False, default=0)
    day_index: Mapped[int] = mapped_column(nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_minutes: Mapped[int | None] = mapped_column(nullable=True)
    budget_per_person: Mapped[int | None] = mapped_column(nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    images: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    google_place_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    # 낙관적 동시성 제어 (Phase 3-A 충돌 해소). PATCH 시 클라가 기대한 버전과 비교.
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )
    # 장소 텍스트의 의미 벡터 (768차원). PostgreSQL: native vector, SQLite: JSON 배열.
    embedding: Mapped[list[float] | None] = mapped_column(CompatibleVector(768), nullable=True)

    trip: Mapped["Trip"] = relationship("Trip", back_populates="locations")
