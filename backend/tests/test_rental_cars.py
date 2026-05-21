"""렌터카·보험 메타서치 테스트 (mock provider)
- GET /rental-cars/search   도시·기간 기반 차량+보험 검색
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


@pytest.mark.asyncio
async def test_search_returns_mock_offers(client: AsyncClient):
    token = await register_and_login(client, email="rc1@ex.com")
    res = await client.get(
        "/rental-cars/search",
        params={"city": "제주", "pickup_date": "2026-09-01", "return_date": "2026-09-04"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["data_source"] == "mock"
    assert data["rental_days"] == 3
    assert len(data["offers"]) > 0
    o = data["offers"][0]
    assert o["total_price_krw"] > 0 and o["deeplink"].startswith("http")
    assert o["insurance_level"] in ("none", "basic", "full")


@pytest.mark.asyncio
async def test_offers_sorted_by_total_price(client: AsyncClient):
    token = await register_and_login(client, email="rc2@ex.com")
    res = await client.get(
        "/rental-cars/search",
        params={"city": "도쿄", "pickup_date": "2026-09-01", "return_date": "2026-09-05"},
        headers={"Authorization": f"Bearer {token}"},
    )
    totals = [o["total_price_krw"] for o in res.json()["data"]["offers"]]
    assert totals == sorted(totals)


@pytest.mark.asyncio
async def test_insurance_filter(client: AsyncClient):
    token = await register_and_login(client, email="rc3@ex.com")
    res = await client.get(
        "/rental-cars/search",
        params={
            "city": "오사카",
            "pickup_date": "2026-09-01",
            "return_date": "2026-09-03",
            "insurance_level": "full",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    levels = {o["insurance_level"] for o in res.json()["data"]["offers"]}
    assert levels == {"full"}


@pytest.mark.asyncio
async def test_invalid_date_range_422(client: AsyncClient):
    token = await register_and_login(client, email="rc4@ex.com")
    res = await client.get(
        "/rental-cars/search",
        params={"city": "제주", "pickup_date": "2026-09-05", "return_date": "2026-09-05"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    res = await client.get(
        "/rental-cars/search",
        params={"city": "제주", "pickup_date": "2026-09-01", "return_date": "2026-09-04"},
    )
    assert res.status_code in (401, 403)
