"""쿠폰 비즈니스 로직 — 발급(claim)/사용(use)/상태 산출."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon, UserCoupon
from app.repositories.coupon_repository import CouponRepository


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def derive_status(uc: UserCoupon, coupon: Coupon) -> str:
    """보유 쿠폰의 표시 상태: used | expired | available."""
    if uc.used_at is not None:
        return "used"
    if coupon.valid_until is not None and coupon.valid_until < _utcnow_naive():
        return "expired"
    return "available"


class CouponService:
    def __init__(self) -> None:
        self.repo = CouponRepository()

    async def list_available(self, db: AsyncSession, user_id: int) -> list[tuple[Coupon, bool]]:
        """발급 가능한 쿠폰 + 현재 사용자의 발급 여부(already_claimed)."""
        coupons = await self.repo.list_available(db)
        claimed = await self.repo.claimed_coupon_ids(db, user_id)
        return [(c, c.id in claimed) for c in coupons]

    async def claim(self, db: AsyncSession, user_id: int, coupon_id: int) -> UserCoupon:
        coupon = await self.repo.get_active_coupon(db, coupon_id)
        if coupon is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="쿠폰을 찾을 수 없습니다."
            )
        if coupon.valid_until is not None and coupon.valid_until < _utcnow_naive():
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="만료된 쿠폰입니다.")
        # 중복 발급 방지
        existing = await self.repo.get_user_coupon(db, user_id, coupon_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="이미 발급받은 쿠폰입니다."
            )
        # 전체 발급 한도 확인
        if coupon.max_claims is not None:
            claims = await self.repo.count_claims(db, coupon_id)
            if claims >= coupon.max_claims:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="쿠폰이 모두 소진되었습니다.",
                )
        return await self.repo.add_user_coupon(db, user_id, coupon_id)

    async def list_my(self, db: AsyncSession, user_id: int) -> list[tuple[UserCoupon, Coupon, str]]:
        rows = await self.repo.list_user_coupons(db, user_id)
        return [(uc, c, derive_status(uc, c)) for uc, c in rows]

    async def use(
        self, db: AsyncSession, user_id: int, user_coupon_id: int
    ) -> tuple[UserCoupon, Coupon]:
        uc = await self.repo.get_user_coupon_by_id(db, user_id, user_coupon_id)
        if uc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="보유한 쿠폰이 아닙니다."
            )
        coupon = await self.repo.get_active_coupon(db, uc.coupon_id)
        if coupon is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="쿠폰을 찾을 수 없습니다."
            )
        status_now = derive_status(uc, coupon)
        if status_now == "used":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="이미 사용한 쿠폰입니다."
            )
        if status_now == "expired":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="만료된 쿠폰입니다.")
        uc.used_at = _utcnow_naive()
        await db.flush()
        await db.refresh(uc)
        return uc, coupon
