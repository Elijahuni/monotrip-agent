"""사용자 획득 배지 모델.

배지 정의는 gamification_service.py의 BADGE_CATALOG에서 관리.
이 테이블은 "누가 어떤 배지를 언제 획득했는가"만 저장.
"""
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserBadge(Base):
    __tablename__ = "user_badges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id: Mapped[str] = mapped_column(String(50), nullable=False)  # 예: "first_trip", "explorer"
    earned_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
