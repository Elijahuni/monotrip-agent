"""FAQ 데이터 접근 계층."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faq import Faq


class FaqRepository:
    async def list_published(
        self, db: AsyncSession, *, category: str | None
    ) -> list[Faq]:
        """게시된 FAQ 목록. order_index 오름차순, 동률이면 id 오름차순."""
        stmt = (
            select(Faq)
            .where(Faq.is_published.is_(True))
            .order_by(Faq.order_index.asc(), Faq.id.asc())
        )
        if category:
            stmt = stmt.where(Faq.category == category)
        return list((await db.execute(stmt)).scalars().all())

    async def get_published(self, db: AsyncSession, faq_id: int) -> Faq | None:
        stmt = select(Faq).where(Faq.id == faq_id).where(Faq.is_published.is_(True))
        return (await db.execute(stmt)).scalars().first()
