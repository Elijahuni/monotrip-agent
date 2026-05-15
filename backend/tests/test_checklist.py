"""
체크리스트 API 테스트
- POST   /trips/{id}/checklist
- GET    /trips/{id}/checklist
- PATCH  /trips/{id}/checklist/{item_id}
- DELETE /trips/{id}/checklist/{item_id}
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login

# ─── 픽스처 ───────────────────────────────────────────────────────────────────

async def _make_trip(client: AsyncClient, token: str) -> int:
    res = await client.post(
        "/trips",
        json={"title": "체크리스트 테스트 여행"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["data"]["id"]


# ─── 테스트 ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_checklist_item(client: AsyncClient):
    token = await register_and_login(client, email="chk1@ex.com")
    trip_id = await _make_trip(client, token)

    res = await client.post(
        f"/trips/{trip_id}/checklist",
        json={"category": "서류", "text": "여권 확인"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["text"] == "여권 확인"
    assert body["data"]["category"] == "서류"
    assert body["data"]["is_checked"] is False


@pytest.mark.asyncio
async def test_list_checklist_items(client: AsyncClient):
    token = await register_and_login(client, email="chk2@ex.com")
    trip_id = await _make_trip(client, token)
    hdrs = {"Authorization": f"Bearer {token}"}

    # 2개 추가
    await client.post(f"/trips/{trip_id}/checklist", json={"category": "서류", "text": "여권"}, headers=hdrs)
    await client.post(f"/trips/{trip_id}/checklist", json={"category": "짐", "text": "충전기"}, headers=hdrs)

    res = await client.get(f"/trips/{trip_id}/checklist", headers=hdrs)
    assert res.status_code == 200
    items = res.json()["data"]
    assert len(items) == 2
    texts = {i["text"] for i in items}
    assert texts == {"여권", "충전기"}


@pytest.mark.asyncio
async def test_toggle_checklist_item(client: AsyncClient):
    token = await register_and_login(client, email="chk3@ex.com")
    trip_id = await _make_trip(client, token)
    hdrs = {"Authorization": f"Bearer {token}"}

    add_res = await client.post(
        f"/trips/{trip_id}/checklist",
        json={"category": "서류", "text": "비자"},
        headers=hdrs,
    )
    item_id = add_res.json()["data"]["id"]

    # 체크 → True
    toggle = await client.patch(
        f"/trips/{trip_id}/checklist/{item_id}",
        json={"is_checked": True},
        headers=hdrs,
    )
    assert toggle.status_code == 200
    assert toggle.json()["data"]["is_checked"] is True

    # 체크 해제 → False
    toggle2 = await client.patch(
        f"/trips/{trip_id}/checklist/{item_id}",
        json={"is_checked": False},
        headers=hdrs,
    )
    assert toggle2.json()["data"]["is_checked"] is False


@pytest.mark.asyncio
async def test_delete_checklist_item(client: AsyncClient):
    token = await register_and_login(client, email="chk4@ex.com")
    trip_id = await _make_trip(client, token)
    hdrs = {"Authorization": f"Bearer {token}"}

    add_res = await client.post(
        f"/trips/{trip_id}/checklist",
        json={"category": "짐", "text": "선크림"},
        headers=hdrs,
    )
    item_id = add_res.json()["data"]["id"]

    del_res = await client.delete(f"/trips/{trip_id}/checklist/{item_id}", headers=hdrs)
    assert del_res.status_code == 200

    # 목록에서 사라졌는지 확인
    list_res = await client.get(f"/trips/{trip_id}/checklist", headers=hdrs)
    ids = [i["id"] for i in list_res.json()["data"]]
    assert item_id not in ids


@pytest.mark.asyncio
async def test_checklist_unauthorized(client: AsyncClient):
    """다른 유저의 여행에 접근 시 403"""
    owner_token = await register_and_login(client, email="chk_owner@ex.com")
    other_token = await register_and_login(client, email="chk_other@ex.com")
    trip_id = await _make_trip(client, owner_token)

    res = await client.post(
        f"/trips/{trip_id}/checklist",
        json={"category": "서류", "text": "여권"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code in (403, 404)
