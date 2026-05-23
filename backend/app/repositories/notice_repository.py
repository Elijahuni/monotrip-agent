"""공지사항 데이터 접근 계층."""

from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notice import Notice


class NoticeRepository:
    async def list_published(
        self,
        db: AsyncSession,
        *,
        category: str | None,
        limit: int,
        cursor: int | None,
    ) -> list[Notice]:
        """게시된 공지 목록. 고정 공지 우선, 그다음 최신순."""
        stmt = (
            select(Notice)
            .where(Notice.is_published.is_(True))
            .order_by(desc(Notice.is_pinned), desc(Notice.id))
            .limit(limit)
        )
        if category:
            stmt = stmt.where(Notice.category == category)
        if cursor:
            stmt = stmt.where(Notice.id < cursor)
        return list((await db.execute(stmt)).scalars().all())

    async def get_published(self, db: AsyncSession, notice_id: int) -> Notice | None:
        stmt = select(Notice).where(Notice.id == notice_id).where(Notice.is_published.is_(True))
        return (await db.execute(stmt)).scalars().first()
