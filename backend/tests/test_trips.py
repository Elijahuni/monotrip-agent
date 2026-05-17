"""
여행 CRUD 엔드포인트 테스트
- POST   /trips
- GET    /trips
- GET    /trips/{id}
- PATCH  /trips/{id}
- DELETE /trips/{id}
- POST   /trips/{id}/locations
- DELETE /trips/{id}/locations/{loc_id}
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


TRIP_PAYLOAD = {
    "title": "도쿄 봄 여행",
    "description": "벚꽃 여행",
    "start_date": "2026-04-01",
    "end_date": "2026-04-05",
}


# ─── 헬퍼 ──────────────────────────────────────────────────────────────────────


async def create_trip(client: AsyncClient, token: str, payload: dict | None = None) -> dict:
    payload = payload or TRIP_PAYLOAD
    res = await client.post("/trips", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201, res.text
    return res.json()["data"]


# ─── 인증 가드 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_trips_requires_auth(client: AsyncClient):
    res = await client.get("/trips")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_create_trip_requires_auth(client: AsyncClient):
    res = await client.post("/trips", json=TRIP_PAYLOAD)
    assert res.status_code == 401


# ─── 여행 생성 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_trip(client: AsyncClient):
    token = await register_and_login(client, "trip1@test.com", "pass1234", "U1")
    res = await client.post(
        "/trips", json=TRIP_PAYLOAD, headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["title"] == TRIP_PAYLOAD["title"]
    assert "id" in body["data"]


# ─── 여행 목록 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_trips(client: AsyncClient):
    token = await register_and_login(client, "trip2@test.com", "pass1234", "U2")
    await create_trip(client, token)
    await create_trip(client, token, {"title": "오사카 여행"})

    res = await client.get("/trips", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    trips = res.json()["data"]
    assert len(trips) >= 2


# ─── 여행 상세 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_trip_detail(client: AsyncClient):
    token = await register_and_login(client, "trip3@test.com", "pass1234", "U3")
    trip = await create_trip(client, token)

    res = await client.get(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["id"] == trip["id"]
    assert "locations" in body["data"]


@pytest.mark.asyncio
async def test_get_trip_not_found(client: AsyncClient):
    token = await register_and_login(client, "trip3b@test.com", "pass1234", "U3b")
    res = await client.get("/trips/99999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404


# ─── 여행 수정 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_trip(client: AsyncClient):
    token = await register_and_login(client, "trip4@test.com", "pass1234", "U4")
    trip = await create_trip(client, token)

    res = await client.patch(
        f"/trips/{trip['id']}",
        json={"title": "수정된 여행", "description": "업데이트됨"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["title"] == "수정된 여행"


# ─── 여행 삭제 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_trip(client: AsyncClient):
    token = await register_and_login(client, "trip5@test.com", "pass1234", "U5")
    trip = await create_trip(client, token)

    res = await client.delete(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    # 삭제 후 조회하면 404
    res2 = await client.get(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 404


# ─── 타인 여행 접근 금지 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_access_others_trip(client: AsyncClient):
    token_a = await register_and_login(client, "userA@test.com", "pass1234", "A")
    token_b = await register_and_login(client, "userB@test.com", "pass1234", "B")

    trip = await create_trip(client, token_a)

    # B가 A의 여행에 접근 시도 → 403 or 404
    res = await client.get(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert res.status_code in (403, 404)


# ─── 장소 CRUD ─────────────────────────────────────────────────────────────────

LOCATION_PAYLOAD = {
    "name": "도쿄 타워",
    "address": "일본 도쿄 미나토구",
    "latitude": 35.6586,
    "longitude": 139.7454,
    "category": "관광지",
    "visit_order": 1,
    "notes": "야경 명소",
}


@pytest.mark.asyncio
async def test_create_location(client: AsyncClient):
    token = await register_and_login(client, "loc1@test.com", "pass1234", "L1")
    trip = await create_trip(client, token)

    res = await client.post(
        f"/trips/{trip['id']}/locations",
        json=LOCATION_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["data"]["name"] == LOCATION_PAYLOAD["name"]
    assert "id" in body["data"]


@pytest.mark.asyncio
async def test_get_trip_with_locations(client: AsyncClient):
    token = await register_and_login(client, "loc2@test.com", "pass1234", "L2")
    trip = await create_trip(client, token)

    # 장소 추가
    await client.post(
        f"/trips/{trip['id']}/locations",
        json=LOCATION_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"},
    )

    # 상세 조회 시 locations 포함 확인
    res = await client.get(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    locations = res.json()["data"]["locations"]
    assert len(locations) >= 1
    assert locations[0]["name"] == LOCATION_PAYLOAD["name"]


@pytest.mark.asyncio
async def test_delete_location(client: AsyncClient):
    token = await register_and_login(client, "loc3@test.com", "pass1234", "L3")
    trip = await create_trip(client, token)

    loc_res = await client.post(
        f"/trips/{trip['id']}/locations",
        json=LOCATION_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"},
    )
    loc_id = loc_res.json()["data"]["id"]

    # 삭제
    del_res = await client.delete(
        f"/trips/{trip['id']}/locations/{loc_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200

    # 삭제 후 상세에서 없어야 함
    detail = await client.get(f"/trips/{trip['id']}", headers={"Authorization": f"Bearer {token}"})
    loc_ids = [loc["id"] for loc in detail.json()["data"]["locations"]]
    assert loc_id not in loc_ids


# ─── 공유 토큰 ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_share_trip_creates_token(client: AsyncClient):
    """공유 토큰 발급 시 토큰과 만료일이 반환된다."""
    token = await register_and_login(client, "share1@test.com", "pass1234", "SH1")
    trip = await create_trip(client, token)

    res = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "share_token" in data
    assert "expires_at" in data
    assert data["share_token"] is not None
    assert data["expires_at"] is not None


@pytest.mark.asyncio
async def test_get_shared_trip_valid(client: AsyncClient):
    """유효한 공유 토큰으로 여행을 열람할 수 있다."""
    token = await register_and_login(client, "share2@test.com", "pass1234", "SH2")
    trip = await create_trip(client, token)

    share_res = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )
    share_token = share_res.json()["data"]["share_token"]

    res = await client.get(f"/trips/shared/{share_token}")
    assert res.status_code == 200
    assert res.json()["data"]["trip"]["id"] == trip["id"]


@pytest.mark.asyncio
async def test_get_shared_trip_expired(client: AsyncClient, db_session):
    """만료된 공유 토큰은 410을 반환한다."""
    from sqlalchemy import update
    from app.models.trip import Trip

    token = await register_and_login(client, "share3@test.com", "pass1234", "SH3")
    trip = await create_trip(client, token)

    share_res = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )
    share_token = share_res.json()["data"]["share_token"]

    # DB에서 직접 만료 시각을 과거로 설정
    await db_session.execute(
        update(Trip)
        .where(Trip.share_token == share_token)
        .values(share_token_expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    )
    await db_session.commit()

    res = await client.get(f"/trips/shared/{share_token}")
    assert res.status_code == 410


@pytest.mark.asyncio
async def test_get_shared_trip_null_expiry(client: AsyncClient, db_session):
    """expires_at이 NULL인 공유 토큰은 만료로 간주해 410을 반환한다."""
    from sqlalchemy import update
    from app.models.trip import Trip

    token = await register_and_login(client, "share4@test.com", "pass1234", "SH4")
    trip = await create_trip(client, token)

    share_res = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )
    share_token = share_res.json()["data"]["share_token"]

    # expires_at을 NULL로 강제
    await db_session.execute(
        update(Trip).where(Trip.share_token == share_token).values(share_token_expires_at=None)
    )
    await db_session.commit()

    res = await client.get(f"/trips/shared/{share_token}")
    assert res.status_code == 410


@pytest.mark.asyncio
async def test_share_token_reused_when_valid(client: AsyncClient):
    """유효한 토큰이 있으면 재발급하지 않고 동일 토큰을 반환한다."""
    token = await register_and_login(client, "share5@test.com", "pass1234", "SH5")
    trip = await create_trip(client, token)

    res1 = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )
    res2 = await client.post(
        f"/trips/{trip['id']}/share", headers={"Authorization": f"Bearer {token}"}
    )

    assert res1.json()["data"]["share_token"] == res2.json()["data"]["share_token"]
