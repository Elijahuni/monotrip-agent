"""1:1 다이렉트 메시지(DM).

대화는 별도 테이블 없이 (sender_id, recipient_id) 쌍으로 파생한다.
read_at이 NULL이면 수신자가 아직 읽지 않은 메시지.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        # 스레드 조회(양방향) + 안 읽은 메시지 카운트 최적화
        Index("ix_dm_pair", "sender_id", "recipient_id", "id"),
        Index("ix_dm_recipient_unread", "recipient_id", "read_at"),
    )
