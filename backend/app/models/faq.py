"""고객센터 FAQ — 운영자가 작성하는 자주 묻는 질문/답변.

읽기 전용(모바일). 작성/수정은 어드민 패널에서 관리.
"""

from datetime import datetime

from sqlalchemy import Boolean, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Faq(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # general | account | booking | payment | travel | etc
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="general")
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    # 노출 순서 (오름차순)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
