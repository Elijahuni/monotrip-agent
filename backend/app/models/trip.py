from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.location import Location


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    destination: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(nullable=True)
    end_date: Mapped[date | None] = mapped_column(nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    total_budget: Mapped[int | None] = mapped_column(nullable=True)
    group_size: Mapped[int] = mapped_column(nullable=False, default=1)
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    share_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )

    locations: Mapped[list["Location"]] = relationship(
        "Location",
        back_populates="trip",
        order_by="Location.visit_order",
        cascade="all, delete-orphan",
        lazy="noload",
    )
