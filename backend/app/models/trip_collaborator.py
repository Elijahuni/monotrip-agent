"""여행 공동 편집자 (Phase 3-A).

기존 share_token은 읽기 전용 공유. 이 모델은 편집 권한이 있는 협업자 관리.
초대 흐름: trip owner → invite token 발급 → 카카오톡 등으로 공유 → 받는 사람이 accept → 협업자 등록.
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.user import User


class TripCollaborator(Base):
    __tablename__ = "trip_collaborators"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="edit")  # owner | edit | view
    joined_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator"),
        Index("ix_collaborator_user", "user_id"),
    )


class TripInvite(Base):
    """초대 토큰. accepted_at이 NULL이면 미사용."""
    __tablename__ = "trip_invites"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="edit")
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    accepted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_invite_token", "token"),
        Index("ix_invite_trip", "trip_id"),
    )
