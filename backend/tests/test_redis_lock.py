"""Redis 분산 락(single_flight) 테스트.

핵심 계약:
  - Redis 미설정 → 락 없이 항상 실행 (단일 워커 가정)
  - 락 획득 성공 → 잡 실행
  - 다른 워커가 락 보유(SET NX 실패) → 잡 스킵
  - Redis 장애(예외) → 가용성 우선, 잡 실행
"""

import pytest

from app.services import redis_lock


@pytest.mark.asyncio
async def test_runs_when_redis_unset(monkeypatch):
    """Redis 미설정 시 데코레이트된 잡이 그대로 실행된다."""
    monkeypatch.setattr(redis_lock, "get_shared_redis", lambda: None)

    calls = []

    @redis_lock.single_flight("lock:test", ttl_seconds=60)
    async def job():
        calls.append(1)
        return "done"

    assert await job() == "done"
    assert calls == [1]


class _FakeRedis:
    def __init__(self, acquired: bool):
        self._acquired = acquired
        self.set_calls = []

    async def set(self, key, value, nx=False, ex=None):
        self.set_calls.append((key, nx, ex))
        # SET NX: 락 미보유면 True, 보유 중이면 None
        return True if self._acquired else None


@pytest.mark.asyncio
async def test_runs_when_lock_acquired(monkeypatch):
    fake = _FakeRedis(acquired=True)
    monkeypatch.setattr(redis_lock, "get_shared_redis", lambda: fake)

    ran = []

    @redis_lock.single_flight("lock:job:x", ttl_seconds=120)
    async def job():
        ran.append(1)

    await job()
    assert ran == [1]
    # SET 이 NX/EX 옵션으로 호출됐는지 확인
    assert fake.set_calls == [("lock:job:x", True, 120)]


@pytest.mark.asyncio
async def test_skips_when_lock_held(monkeypatch):
    fake = _FakeRedis(acquired=False)
    monkeypatch.setattr(redis_lock, "get_shared_redis", lambda: fake)

    ran = []

    @redis_lock.single_flight("lock:job:x", ttl_seconds=120)
    async def job():
        ran.append(1)
        return "should-not-run"

    result = await job()
    assert result is None
    assert ran == []  # 다른 워커가 락 보유 → 실행 안 됨


@pytest.mark.asyncio
async def test_runs_on_redis_error(monkeypatch):
    """락 인프라 장애 시 잡을 막지 않는다(가용성 우선)."""

    class _BrokenRedis:
        async def set(self, *a, **k):
            raise RuntimeError("redis down")

    monkeypatch.setattr(redis_lock, "get_shared_redis", lambda: _BrokenRedis())

    ran = []

    @redis_lock.single_flight("lock:job:x", ttl_seconds=60)
    async def job():
        ran.append(1)

    await job()
    assert ran == [1]
