"""쿠폰 API 테스트
- GET  /coupons/available            발급 가능 혜택(활성+미만료), already_claimed 표시
- POST /coupons/{id}/claim           발급 (중복 409, 만료 410, 한도 409)
- GET  /coupons/me                   보유 쿠폰함 (status 산출)
- POST /coupons/me/{id}/use          사용 (중복 409)
"""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon
from tests.conftest import register_and_login


async def _seed_coupon(db: AsyncSession, **kwargs) -> Coupon:
    coupon = Coupon(
        code=kwargs["code"],
        title=kwargs.get("title", "혜택"),
        description=kwargs.get("description"),
        discount_type=kwargs.get("discount_type", "amount"),
        discount_value=kwargs.get("discount_value", 5000),
        min_order_amount=kwargs.get("min_order_amount", 0),
        valid_until=kwargs.get("valid_until"),
        max_claims=kwargs.get("max_claims"),
        is_active=kwargs.get("is_active", True),
    )
    db.add(coupon)
    await db.flush()
    await db.refresh(coupon)
    return coupon


@pytest.mark.asyncio
async def test_available_excludes_inactive_and_expired(
    client: AsyncClient, db_session: AsyncSession
):
    token = await register_and_login(client, email="cp1@ex.com")
    await _seed_coupon(db_session, code="ACTIVE", title="활성")
    await _seed_coupon(db_session, code="INACTIVE", title="비활성", is_active=False)
    await _seed_coupon(
        db_session, code="EXPIRED", title="만료", valid_until=datetime.utcnow() - timedelta(days=1)
    )

    res = await client.get("/coupons/available", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    codes = {c["code"] for c in res.json()["data"]}
    assert codes == {"ACTIVE"}
    assert res.json()["data"][0]["already_claimed"] is False


@pytest.mark.asyncio
async def test_claim_then_shows_in_my_and_marks_claimed(
    client: AsyncClient, db_session: AsyncSession
):
    token = await register_and_login(client, email="cp2@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    coupon = await _seed_coupon(db_session, code="WELCOME", title="웰컴")

    claim = await client.post(f"/coupons/{coupon.id}/claim", headers=hdrs)
    assert claim.status_code == 201, claim.text
    assert claim.json()["data"]["status"] == "available"

    # 보유 쿠폰함에 노출
    me = await client.get("/coupons/me", headers=hdrs)
    assert {c["code"] for c in me.json()["data"]} == {"WELCOME"}

    # available 목록에선 already_claimed=True
    avail = await client.get("/coupons/available", headers=hdrs)
    item = next(c for c in avail.json()["data"] if c["code"] == "WELCOME")
    assert item["already_claimed"] is True


@pytest.mark.asyncio
async def test_duplicate_claim_409(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="cp3@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    coupon = await _seed_coupon(db_session, code="ONCE")

    assert (await client.post(f"/coupons/{coupon.id}/claim", headers=hdrs)).status_code == 201
    dup = await client.post(f"/coupons/{coupon.id}/claim", headers=hdrs)
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_claim_expired_410(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="cp4@ex.com")
    coupon = await _seed_coupon(
        db_session, code="OLD", valid_until=datetime.utcnow() - timedelta(hours=1)
    )
    res = await client.post(
        f"/coupons/{coupon.id}/claim", headers={"Authorization": f"Bearer {token}"}
    )
    # available에서 빠지지만 직접 claim 시 만료(410)
    assert res.status_code in (404, 410)


@pytest.mark.asyncio
async def test_max_claims_exhausted_409(client: AsyncClient, db_session: AsyncSession):
    coupon = await _seed_coupon(db_session, code="LIMITED", max_claims=1)
    t1 = await register_and_login(client, email="cp5a@ex.com")
    t2 = await register_and_login(client, email="cp5b@ex.com")

    first = await client.post(
        f"/coupons/{coupon.id}/claim", headers={"Authorization": f"Bearer {t1}"}
    )
    assert first.status_code == 201
    second = await client.post(
        f"/coupons/{coupon.id}/claim", headers={"Authorization": f"Bearer {t2}"}
    )
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_use_coupon_and_double_use_409(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="cp6@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    coupon = await _seed_coupon(db_session, code="USABLE")

    claim = await client.post(f"/coupons/{coupon.id}/claim", headers=hdrs)
    uc_id = claim.json()["data"]["user_coupon_id"]

    used = await client.post(f"/coupons/me/{uc_id}/use", headers=hdrs)
    assert used.status_code == 200
    assert used.json()["data"]["status"] == "used"

    again = await client.post(f"/coupons/me/{uc_id}/use", headers=hdrs)
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    assert (await client.get("/coupons/available")).status_code in (401, 403)
    assert (await client.get("/coupons/me")).status_code in (401, 403)
