"""실시간 협업 테스트
- _decode_token: WebSocket 인증 게이트(JWT query param) 디코드 로직
- TripConnectionManager: 룸 입장/브로드캐스트(발신자 제외)/퇴장/presence

실제 WebSocket 핸들러는 권한 확인에 실 PostgreSQL(AsyncSessionLocal)을 사용하고
TestClient는 lifespan(스케줄러)을 띄우므로, 결정론적인 인증 디코드와 인메모리
연결 매니저 로직만 단위 테스트한다.
"""

import pytest
from jose import jwt

from app.config import get_settings
from app.routes.realtime import _decode_token
from app.services.realtime import TripConnectionManager


# ─── _decode_token ─────────────────────────────────────────────────────────────


def _make_token(sub) -> str:
    settings = get_settings()
    return jwt.encode({"sub": sub}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest.mark.asyncio
async def test_decode_token_valid():
    token = _make_token("42")
    assert await _decode_token(token) == 42


@pytest.mark.asyncio
async def test_decode_token_invalid_signature():
    bad = jwt.encode({"sub": "42"}, "wrong-secret-value", algorithm="HS256")
    assert await _decode_token(bad) is None


@pytest.mark.asyncio
async def test_decode_token_malformed():
    assert await _decode_token("not-a-jwt-token") is None


@pytest.mark.asyncio
async def test_decode_token_non_numeric_sub():
    token = _make_token("abc")  # int("abc") → ValueError → None
    assert await _decode_token(token) is None


# ─── TripConnectionManager ──────────────────────────────────────────────────────


class FakeWebSocket:
    """send_json 만 흉내내는 가짜 WebSocket."""

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, message: dict) -> None:
        self.sent.append(message)


@pytest.mark.asyncio
async def test_connect_tracks_presence():
    mgr = TripConnectionManager()
    ws1 = FakeWebSocket()
    ws2 = FakeWebSocket()

    await mgr.connect(1, ws1, user_id=10, nickname="앨리스")
    await mgr.connect(1, ws2, user_id=20, nickname="밥")

    assert await mgr.active_user_ids(1) == [10, 20]
    users = await mgr.active_users(1)
    assert {u["id"]: u["nickname"] for u in users} == {10: "앨리스", 20: "밥"}


@pytest.mark.asyncio
async def test_join_broadcasts_to_existing_members():
    mgr = TripConnectionManager()
    ws1 = FakeWebSocket()
    await mgr.connect(1, ws1, user_id=10, nickname="앨리스")
    ws1.sent.clear()  # 본인 입장 이벤트 제거

    # 두 번째 사용자 입장 → 기존 멤버(ws1)에게 presence join 전달
    ws2 = FakeWebSocket()
    await mgr.connect(1, ws2, user_id=20, nickname="밥")

    joins = [m for m in ws1.sent if m.get("type") == "presence" and m.get("event") == "join"]
    assert any(m["user_id"] == 20 for m in joins)


@pytest.mark.asyncio
async def test_broadcast_excludes_sender():
    mgr = TripConnectionManager()
    sender = FakeWebSocket()
    receiver = FakeWebSocket()
    await mgr.connect(1, sender, user_id=10)
    await mgr.connect(1, receiver, user_id=20)
    sender.sent.clear()
    receiver.sent.clear()

    await mgr.broadcast(1, {"type": "location_update", "op": "create"}, exclude_ws=sender)

    assert sender.sent == []
    assert {"type": "location_update", "op": "create"} in receiver.sent


@pytest.mark.asyncio
async def test_broadcast_isolated_per_trip():
    mgr = TripConnectionManager()
    ws_trip1 = FakeWebSocket()
    ws_trip2 = FakeWebSocket()
    await mgr.connect(1, ws_trip1, user_id=10)
    await mgr.connect(2, ws_trip2, user_id=20)
    ws_trip1.sent.clear()
    ws_trip2.sent.clear()

    await mgr.broadcast(1, {"type": "ping"}, exclude_ws=None)

    assert {"type": "ping"} in ws_trip1.sent
    assert ws_trip2.sent == []  # 다른 trip 룸에는 전달 안 됨


@pytest.mark.asyncio
async def test_disconnect_removes_user_and_notifies():
    mgr = TripConnectionManager()
    ws1 = FakeWebSocket()
    ws2 = FakeWebSocket()
    await mgr.connect(1, ws1, user_id=10, nickname="앨리스")
    await mgr.connect(1, ws2, user_id=20, nickname="밥")
    ws1.sent.clear()

    await mgr.disconnect(1, ws2, user_id=20)

    # 남은 멤버 목록에서 20 제거
    assert await mgr.active_user_ids(1) == [10]
    # 남은 멤버(ws1)에게 leave 이벤트 전달
    leaves = [m for m in ws1.sent if m.get("type") == "presence" and m.get("event") == "leave"]
    assert any(m["user_id"] == 20 for m in leaves)


@pytest.mark.asyncio
async def test_room_cleaned_up_when_empty():
    mgr = TripConnectionManager()
    ws1 = FakeWebSocket()
    await mgr.connect(1, ws1, user_id=10)
    await mgr.disconnect(1, ws1, user_id=10)

    assert await mgr.active_user_ids(1) == []
