"""쿠폰 데이터 접근 계층."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon, UserCoupon


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CouponRepository:
    async def list_available(self, db: AsyncSession) -> list[Coupon]:
        """발급 가능한(활성 + 미만료) 쿠폰 카탈로그."""
        now = _utcnow_naive()
        stmt = (
            select(Coupon)
            .where(Coupon.is_active.is_(True))
            .where((Coupon.valid_until.is_(None)) | (Coupon.valid_until > now))
            .order_by(desc(Coupon.id))
        )
        return list((await db.execute(stmt)).scalars().all())

    async def get_active_coupon(self, db: AsyncSession, coupon_id: int) -> Coupon | None:
        stmt = select(Coupon).where(Coupon.id == coupon_id).where(Coupon.is_active.is_(True))
        return (await db.execute(stmt)).scalars().first()

    async def get_user_coupon(
        self, db: AsyncSession, user_id: int, coupon_id: int
    ) -> UserCoupon | None:
        stmt = (
            select(UserCoupon)
            .where(UserCoupon.user_id == user_id)
            .where(UserCoupon.coupon_id == coupon_id)
        )
        return (await db.execute(stmt)).scalars().first()

    async def get_user_coupon_by_id(
        self, db: AsyncSession, user_id: int, user_coupon_id: int
    ) -> UserCoupon | None:
        stmt = (
            select(UserCoupon)
            .where(UserCoupon.id == user_coupon_id)
            .where(UserCoupon.user_id == user_id)
        )
        return (await db.execute(stmt)).scalars().first()

    async def count_claims(self, db: AsyncSession, coupon_id: int) -> int:
        stmt = select(func.count(UserCoupon.id)).where(UserCoupon.coupon_id == coupon_id)
        return (await db.execute(stmt)).scalar() or 0

    async def claimed_coupon_ids(self, db: AsyncSession, user_id: int) -> set[int]:
        stmt = select(UserCoupon.coupon_id).where(UserCoupon.user_id == user_id)
        return set((await db.execute(stmt)).scalars().all())

    async def add_user_coupon(self, db: AsyncSession, user_id: int, coupon_id: int) -> UserCoupon:
        uc = UserCoupon(user_id=user_id, coupon_id=coupon_id)
        db.add(uc)
        await db.flush()
        await db.refresh(uc)
        return uc

    async def list_user_coupons(
        self, db: AsyncSession, user_id: int
    ) -> list[tuple[UserCoupon, Coupon]]:
        """보유 쿠폰 + 쿠폰 상세. 최근 발급순."""
        stmt = (
            select(UserCoupon, Coupon)
            .join(Coupon, Coupon.id == UserCoupon.coupon_id)
            .where(UserCoupon.user_id == user_id)
            .order_by(desc(UserCoupon.id))
        )
        return [(uc, c) for uc, c in (await db.execute(stmt)).all()]
