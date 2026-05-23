"""쿠폰 라우트 — 발급 가능 혜택 조회, 발급(claim), 보유 쿠폰함, 사용(use)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.coupon_service import CouponService, derive_status

router = APIRouter(prefix="/coupons", tags=["coupons"])
_service = CouponService()


class AvailableCouponResponse(BaseModel):
    id: int
    code: str
    title: str
    description: str | None
    discount_type: str
    discount_value: int
    min_order_amount: int
    valid_until: datetime | None
    already_claimed: bool


class MyCouponResponse(BaseModel):
    user_coupon_id: int
    coupon_id: int
    code: str
    title: str
    description: str | None
    discount_type: str
    discount_value: int
    min_order_amount: int
    valid_until: datetime | None
    status: str  # available | used | expired
    claimed_at: datetime
    used_at: datetime | None


@router.get("/available", response_model=ApiResponse[list[AvailableCouponResponse]])
async def list_available_coupons(
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[AvailableCouponResponse]]:
    rows = await _service.list_available(db, current_user.id)
    return ApiResponse(
        data=[
            AvailableCouponResponse(
                id=c.id,
                code=c.code,
                title=c.title,
                description=c.description,
                discount_type=c.discount_type,
                discount_value=c.discount_value,
                min_order_amount=c.min_order_amount,
                valid_until=c.valid_until,
                already_claimed=claimed,
            )
            for c, claimed in rows
        ]
    )


@router.post("/{coupon_id}/claim", response_model=ApiResponse[MyCouponResponse], status_code=201)
@limiter.limit("30/hour")
async def claim_coupon(
    request: Request,
    coupon_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[MyCouponResponse]:
    uc = await _service.claim(db, current_user.id, coupon_id)
    # 발급 직후 상세 구성을 위해 보유 목록에서 해당 항목 조회
    coupon = await _service.repo.get_active_coupon(db, coupon_id)
    assert coupon is not None  # claim이 성공했으므로 활성 쿠폰 존재
    return ApiResponse(
        data=MyCouponResponse(
            user_coupon_id=uc.id,
            coupon_id=coupon.id,
            code=coupon.code,
            title=coupon.title,
            description=coupon.description,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            min_order_amount=coupon.min_order_amount,
            valid_until=coupon.valid_until,
            status=derive_status(uc, coupon),
            claimed_at=uc.claimed_at,
            used_at=uc.used_at,
        ),
        message="쿠폰이 발급되었습니다.",
    )


@router.get("/me", response_model=ApiResponse[list[MyCouponResponse]])
async def list_my_coupons(
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[MyCouponResponse]]:
    rows = await _service.list_my(db, current_user.id)
    return ApiResponse(
        data=[
            MyCouponResponse(
                user_coupon_id=uc.id,
                coupon_id=c.id,
                code=c.code,
                title=c.title,
                description=c.description,
                discount_type=c.discount_type,
                discount_value=c.discount_value,
                min_order_amount=c.min_order_amount,
                valid_until=c.valid_until,
                status=st,
                claimed_at=uc.claimed_at,
                used_at=uc.used_at,
            )
            for uc, c, st in rows
        ]
    )


@router.post("/me/{user_coupon_id}/use", response_model=ApiResponse[MyCouponResponse])
async def use_coupon(
    user_coupon_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[MyCouponResponse]:
    uc, coupon = await _service.use(db, current_user.id, user_coupon_id)
    return ApiResponse(
        data=MyCouponResponse(
            user_coupon_id=uc.id,
            coupon_id=coupon.id,
            code=coupon.code,
            title=coupon.title,
            description=coupon.description,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            min_order_amount=coupon.min_order_amount,
            valid_until=coupon.valid_until,
            status=derive_status(uc, coupon),
            claimed_at=uc.claimed_at,
            used_at=uc.used_at,
        ),
        message="쿠폰을 사용했습니다.",
    )
