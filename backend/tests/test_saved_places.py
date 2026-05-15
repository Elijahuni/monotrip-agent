"""
보관함(찜한 장소) API 테스트
- GET    /saved-places
- POST   /saved-places
- DELETE /saved-places/{id}
- POST   /saved-places/{id}/add-to-trip
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login

# ─── 공통 픽스처 ─────────────────────────────────────────────────────────────

SAMPLE_PLACE = {
    "name": "경복궁",
    "address": "서울 종로구 사직로 161",
    "latitude": 37.5796,
    "longitude": 126.9770,
    "category": "관광지",
    "notes": "꼭 가봐야 할 곳",
    "rating": 4.8,
}


async def _make_trip(client: AsyncClient, token: str) -> int:
    res = await client.post(
        "/trips",
        json={"title": "보관함 연동 여행"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return res.json()["data"]["id"]


# ─── 테스트 ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_place(client: AsyncClient):
    token = await register_and_login(client, email="sp1@ex.com")

    res = await client.post(
        "/saved-places",
        json=SAMPLE_PLACE,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["name"] == "경복궁"
    assert body["data"]["category"] == "관광지"


@pytest.mark.asyncio
async def test_list_saved_places(client: AsyncClient):
    token = await register_and_login(client, email="sp2@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}

    await client.post("/saved-places", json={**SAMPLE_PLACE, "name": "인사동"}, headers=hdrs)
    await client.post("/saved-places", json={**SAMPLE_PLACE, "name": "북촌한옥마을"}, headers=hdrs)

    res = await client.get("/saved-places", headers=hdrs)
    assert res.status_code == 200
    names = {p["name"] for p in res.json()["data"]}
    assert "인사동" in names
    assert "북촌한옥마을" in names


@pytest.mark.asyncio
async def test_delete_saved_place(client: AsyncClient):
    token = await register_and_login(client, email="sp3@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}

    save_res = await client.post("/saved-places", json=SAMPLE_PLACE, headers=hdrs)
    place_id = save_res.json()["data"]["id"]

    del_res = await client.delete(f"/saved-places/{place_id}", headers=hdrs)
    assert del_res.status_code == 200

    list_res = await client.get("/saved-places", headers=hdrs)
    ids = [p["id"] for p in list_res.json()["data"]]
    assert place_id not in ids


@pytest.mark.asyncio
async def test_add_saved_place_to_trip(client: AsyncClient):
    token = await register_and_login(client, email="sp4@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    trip_id = await _make_trip(client, token)

    save_res = await client.post("/saved-places", json=SAMPLE_PLACE, headers=hdrs)
    place_id = save_res.json()["data"]["id"]

    add_res = await client.post(
        f"/saved-places/{place_id}/add-to-trip",
        json={"trip_id": trip_id, "visit_order": 1, "day_index": 1},
        headers=hdrs,
    )
    assert add_res.status_code == 201
    loc = add_res.json()["data"]
    assert loc["name"] == "경복궁"
    assert loc["trip_id"] == trip_id


@pytest.mark.asyncio
async def test_saved_place_not_accessible_by_other_user(client: AsyncClient):
    owner_token = await register_and_login(client, email="sp_owner@ex.com")
    other_token = await register_and_login(client, email="sp_other@ex.com")
    hdrs_owner = {"Authorization": f"Bearer {owner_token}"}
    hdrs_other = {"Authorization": f"Bearer {other_token}"}

    save_res = await client.post("/saved-places", json=SAMPLE_PLACE, headers=hdrs_owner)
    place_id = save_res.json()["data"]["id"]

    # 다른 유저가 삭제 시도 → 403 또는 404
    del_res = await client.delete(f"/saved-places/{place_id}", headers=hdrs_other)
    assert del_res.status_code in (403, 404)
