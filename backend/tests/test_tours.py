"""투어·티켓 메타서치 테스트 (mock provider)
- GET /tours/search   도시 기반 상품 검색, 카테고리 필터, 가격 정렬, 인증
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


@pytest.mark.asyncio
async def test_search_returns_mock_offers(client: AsyncClient):
    token = await register_and_login(client, email="tour1@ex.com")
    res = await client.get(
        "/tours/search",
        params={"city": "도쿄"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["data_source"] == "mock"
    assert len(data["offers"]) > 0
    # 모든 상품에 가격·예약 딥링크 존재
    assert all(o["price_krw"] > 0 and o["deeplink"].startswith("http") for o in data["offers"])


@pytest.mark.asyncio
async def test_offers_sorted_by_price(client: AsyncClient):
    token = await register_and_login(client, email="tour2@ex.com")
    res = await client.get(
        "/tours/search",
        params={"city": "오사카"},
        headers={"Authorization": f"Bearer {token}"},
    )
    prices = [o["price_krw"] for o in res.json()["data"]["offers"]]
    assert prices == sorted(prices)


@pytest.mark.asyncio
async def test_category_filter(client: AsyncClient):
    token = await register_and_login(client, email="tour3@ex.com")
    res = await client.get(
        "/tours/search",
        params={"city": "방콕", "category": "food"},
        headers={"Authorization": f"Bearer {token}"},
    )
    cats = {o["category"] for o in res.json()["data"]["offers"]}
    assert cats == {"food"}


@pytest.mark.asyncio
async def test_deterministic_same_query(client: AsyncClient):
    token = await register_and_login(client, email="tour4@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    r1 = await client.get("/tours/search", params={"city": "파리"}, headers=hdrs)
    r2 = await client.get("/tours/search", params={"city": "파리"}, headers=hdrs)
    ids1 = [o["id"] for o in r1.json()["data"]["offers"]]
    ids2 = [o["id"] for o in r2.json()["data"]["offers"]]
    assert ids1 == ids2


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    res = await client.get("/tours/search", params={"city": "도쿄"})
    assert res.status_code in (401, 403)
