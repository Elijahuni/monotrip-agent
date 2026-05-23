"""오프라인 가이드 — 다운로드해서 오프라인으로 열람하는 도시별 여행 가이드.

운영자가 작성(어드민 관리). 모바일은 상세를 받아 SQLite에 캐시 후 오프라인 열람.
version이 올라가면 모바일이 캐시를 갱신한다.
"""

from datetime import datetime

from sqlalchemy import JSON, Boolean, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OfflineGuide(Base):
    __tablename__ = "offline_guides"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    city: Mapped[str] = mapped_column(String(60), nullable=False)
    country: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 섹션 리스트: [{"heading": str, "body": str}]
    sections: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="ko")
    # 다운로드 용량 표시용 (KB)
    file_size_kb: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 콘텐츠 버전 — 증가 시 모바일 캐시 갱신
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
