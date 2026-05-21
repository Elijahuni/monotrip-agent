"""멀티 워커 환경에서 스케줄 잡 중복 실행을 막는 Redis 분산 락.

배경:
  APScheduler가 각 uvicorn 워커 프로세스 안에서 동작하므로, `--workers N`으로
  띄우면 동일 cron 잡이 N번 실행된다(매일 알림이 N번 발송되는 버그).

전략:
  잡 실행 직전 `SET <key> <token> NX EX <ttl>`로 한 워커만 락을 획득한다.
  - 락 획득 성공 → 잡 실행
  - 이미 다른 워커가 보유 → 조용히 스킵
  - Redis 미설정 → 단일 워커로 간주하고 그대로 실행
  - Redis 장애 → 잡을 막지 않고 실행(가용성 우선)

TTL은 잡 1회 실행 시간을 넉넉히 덮되 다음 실행 주기보다 짧게 설정한다.
"""

from __future__ import annotations

import functools
import logging
import os
import socket
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.services.ai.redis_cache import get_shared_redis

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def try_acquire(key: str, ttl_seconds: int) -> bool:
    """분산 락 획득 시도. 성공/실행 허용이면 True."""
    client = get_shared_redis()
    if client is None:
        # Redis 없음 → 단일 워커 가정, 실행 허용
        return True
    try:
        token = f"{socket.gethostname()}:{os.getpid()}"
        acquired = await client.set(key, token, nx=True, ex=ttl_seconds)
        return bool(acquired)
    except Exception as exc:
        # 락 인프라 장애 시 잡을 막지 않는다(중복 가능성 < 미실행 위험)
        logger.warning("distributed_lock_acquire_failed key=%s err=%s", key, exc)
        return True


def single_flight(
    lock_key: str, ttl_seconds: int
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T | None]]]:
    """스케줄 잡 함수를 감싸 워커 1개만 실행하도록 보장하는 데코레이터."""

    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T | None]]:
        @functools.wraps(fn)
        async def wrapper(*args: object, **kwargs: object) -> T | None:
            if not await try_acquire(lock_key, ttl_seconds):
                logger.info("scheduled_job_skipped_lock_held key=%s", lock_key)
                return None
            return await fn(*args, **kwargs)

        return wrapper

    return decorator
