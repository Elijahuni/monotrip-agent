"""오프라인 가이드 데이터 접근 계층."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.offline_guide import OfflineGuide


class OfflineGuideRepository:
    async def list_published(self, db: AsyncSession, *, city: str | None) -> list[OfflineGuide]:
        stmt = (
            select(OfflineGuide)
            .where(OfflineGuide.is_published.is_(True))
            .order_by(OfflineGuide.city.asc(), OfflineGuide.id.asc())
        )
        if city:
            stmt = stmt.where(OfflineGuide.city == city)
        return list((await db.execute(stmt)).scalars().all())

    async def get_published(self, db: AsyncSession, guide_id: int) -> OfflineGuide | None:
        stmt = (
            select(OfflineGuide)
            .where(OfflineGuide.id == guide_id)
            .where(OfflineGuide.is_published.is_(True))
        )
        return (await db.execute(stmt)).scalars().first()
