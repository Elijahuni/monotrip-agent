"""다이렉트 메시지(DM) API 테스트
- POST /dm/{id}            전송 (자기자신 400, 없는 유저 404)
- GET  /dm/{id}            스레드(양방향) + 조회 시 읽음 처리
- GET  /dm/conversations   대화 목록 + 미읽음 수
- GET  /dm/unread-count    전체 미읽음
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


async def _me_id(client: AsyncClient, token: str) -> int:
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    return res.json()["data"]["id"]


async def _two_users(client: AsyncClient, suffix: str):
    a = await register_and_login(client, email=f"dm_a_{suffix}@ex.com")
    b = await register_and_login(client, email=f"dm_b_{suffix}@ex.com")
    return a, b, await _me_id(client, a), await _me_id(client, b)


@pytest.mark.asyncio
async def test_send_and_thread_is_bidirectional(client: AsyncClient):
    a, b, a_id, b_id = await _two_users(client, "thread")
    ha = {"Authorization": f"Bearer {a}"}
    hb = {"Authorization": f"Bearer {b}"}

    s1 = await client.post(f"/dm/{b_id}", json={"body": "안녕하세요"}, headers=ha)
    assert s1.status_code == 201, s1.text
    await client.post(f"/dm/{a_id}", json={"body": "네 반가워요"}, headers=hb)

    # A가 보는 스레드: 두 메시지 모두 (최신순)
    thread = await client.get(f"/dm/{b_id}", headers=ha)
    bodies = [m["body"] for m in thread.json()["data"]]
    assert set(bodies) == {"안녕하세요", "네 반가워요"}


@pytest.mark.asyncio
async def test_cannot_message_self(client: AsyncClient):
    a = await register_and_login(client, email="dm_self@ex.com")
    a_id = await _me_id(client, a)
    res = await client.post(
        f"/dm/{a_id}", json={"body": "x"}, headers={"Authorization": f"Bearer {a}"}
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_message_nonexistent_user_404(client: AsyncClient):
    a = await register_and_login(client, email="dm_404@ex.com")
    res = await client.post(
        "/dm/999999", json={"body": "x"}, headers={"Authorization": f"Bearer {a}"}
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_unread_count_and_mark_read(client: AsyncClient):
    a, b, a_id, b_id = await _two_users(client, "unread")
    ha = {"Authorization": f"Bearer {a}"}
    hb = {"Authorization": f"Bearer {b}"}

    # A→B 2건 전송
    await client.post(f"/dm/{b_id}", json={"body": "1"}, headers=ha)
    await client.post(f"/dm/{b_id}", json={"body": "2"}, headers=ha)

    # B의 미읽음 = 2
    uc = await client.get("/dm/unread-count", headers=hb)
    assert uc.json()["data"]["unread"] == 2

    # B가 스레드 조회 → 읽음 처리
    await client.get(f"/dm/{a_id}", headers=hb)
    uc2 = await client.get("/dm/unread-count", headers=hb)
    assert uc2.json()["data"]["unread"] == 0


@pytest.mark.asyncio
async def test_conversations_list(client: AsyncClient):
    a, b, a_id, b_id = await _two_users(client, "convo")
    ha = {"Authorization": f"Bearer {a}"}
    hb = {"Authorization": f"Bearer {b}"}

    await client.post(f"/dm/{b_id}", json={"body": "first"}, headers=ha)
    await client.post(f"/dm/{a_id}", json={"body": "마지막 메시지"}, headers=hb)

    # A의 대화 목록: 상대 B, 마지막 메시지, 미읽음 1
    convos = await client.get("/dm/conversations", headers=ha)
    assert convos.status_code == 200, convos.text
    data = convos.json()["data"]
    assert len(data) == 1
    c = data[0]
    assert c["other_user_id"] == b_id
    assert c["last_message"] == "마지막 메시지"
    assert c["unread_count"] == 1
    assert c["last_from_me"] is False


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    assert (await client.get("/dm/conversations")).status_code in (401, 403)
