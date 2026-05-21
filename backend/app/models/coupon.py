"""쿠폰 — 발급 가능한 혜택 카탈로그(Coupon) + 사용자 보유 쿠폰(UserCoupon).

Coupon     : 운영자가 등록하는 혜택(할인). 어드민에서 관리.
UserCoupon : 사용자가 발급(claim)받은 쿠폰. 사용(use) 시 used_at 기록.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # percent | amount
    discount_type: Mapped[str] = mapped_column(String(10), nullable=False, default="amount")
    discount_value: Mapped[int] = mapped_column(Integer, nullable=False)
    # 최소 주문 금액(원). 0이면 제한 없음
    min_order_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_until: Mapped[datetime | None] = mapped_column(nullable=True)
    # 전체 발급 한도(전 사용자 합산). None이면 무제한
    max_claims: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)


class UserCoupon(Base):
    __tablename__ = "user_coupons"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    coupon_id: Mapped[int] = mapped_column(
        ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    claimed_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "coupon_id", name="uq_user_coupon"),
    )
