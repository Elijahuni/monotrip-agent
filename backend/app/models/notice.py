"""공지사항 — 운영자가 작성하는 안내/이벤트/점검/업데이트 공지.

읽기 전용(모바일). 작성/수정은 어드민 패널에서 관리.
"""

from datetime import datetime

from sqlalchemy import Boolean, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # general | event | maintenance | update
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="general")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # 상단 고정 여부 (목록에서 우선 노출)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 게시 여부 (false면 목록/조회에서 제외 — 임시 저장/숨김)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    published_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
