"""Trip별 WebSocket 연결 매니저.

단일 워커: 인메모리 set.
멀티 워커: Redis pub/sub로 워커 간 브로드캐스트.
  - 워커 A에 연결된 사용자가 메시지를 보내면 채널 `trip:{id}`에 publish
  - 모든 워커가 채널을 구독해 자기 워커의 클라이언트에 send_json

Redis 미설정 환경에서도 단일 워커 폴백으로 동작 — 개발/테스트 친화.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.config import get_settings

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis  # noqa: F401

    _REDIS_LIB = True
except ImportError:
    _REDIS_LIB = False


class TripConnectionManager:
    def __init__(self) -> None:
        # trip_id → set of (websocket, user_id)
        self._rooms: dict[int, set[tuple[WebSocket, int]]] = defaultdict(set)
        # user_id → nickname (presence 라벨용 캐시 — connect 시 채움)
        self._nicknames: dict[int, str] = {}
        self._lock = asyncio.Lock()

        # Redis pub/sub (옵션)
        self._redis: "redis.Redis | None" = None
        self._pubsub_task: asyncio.Task[None] | None = None
        self._started = False

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def ensure_started(self) -> None:
        """첫 connect 시점에 1회 Redis 연결 + subscriber 태스크 시작."""
        if self._started:
            return
        self._started = True
        settings = get_settings()
        if not settings.redis_url or not _REDIS_LIB:
            logger.info("Realtime: single-worker in-memory mode (no Redis)")
            return
        try:
            self._redis = redis.from_url(settings.redis_url, decode_responses=True)
            await self._redis.ping()
            self._pubsub_task = asyncio.create_task(self._run_subscriber())
            logger.info("Realtime: Redis pub/sub enabled (%s)", settings.redis_url)
        except Exception as e:
            logger.warning("Realtime: Redis init failed, falling back to in-memory: %s", e)
            self._redis = None

    async def aclose(self) -> None:
        """앱 종료 시 pub/sub 태스크 취소 + Redis 연결 정리. 미설정이면 no-op."""
        if self._pubsub_task is not None:
            self._pubsub_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._pubsub_task
            self._pubsub_task = None
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()
            self._redis = None
        self._started = False

    async def _run_subscriber(self) -> None:
        """Redis 패턴 구독으로 모든 trip:* 채널을 받아 로컬 룸에 fan-out."""
        assert self._redis is not None
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe("trip:*")
        try:
            async for msg in pubsub.listen():
                if msg.get("type") != "pmessage":
                    continue
                channel = msg.get("channel", "")
                try:
                    trip_id = int(channel.split(":", 1)[1])
                    data = json.loads(msg.get("data") or "{}")
                except (ValueError, json.JSONDecodeError):
                    continue
                # exclude_ws=None: 본인 워커 송신자는 publish 측에서 별도 처리
                origin_ws_id = data.pop("__origin_ws_id", None)
                await self._send_local(trip_id, data, exclude_ws_id=origin_ws_id)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("Realtime subscriber crashed: %s", e)
        finally:
            with contextlib.suppress(Exception):
                await pubsub.aclose()

    # ── 룸 관리 ───────────────────────────────────────────────────────────────

    async def connect(
        self,
        trip_id: int,
        ws: WebSocket,
        user_id: int,
        nickname: str | None = None,
    ) -> None:
        await self.ensure_started()
        async with self._lock:
            self._rooms[trip_id].add((ws, user_id))
            if nickname:
                self._nicknames[user_id] = nickname
        await self.broadcast(
            trip_id,
            {
                "type": "presence",
                "event": "join",
                "user_id": user_id,
                "active_users": await self.active_user_ids(trip_id),
                "active": await self.active_users(trip_id),
            },
            exclude_ws=None,
        )

    async def disconnect(self, trip_id: int, ws: WebSocket, user_id: int) -> None:
        async with self._lock:
            self._rooms[trip_id].discard((ws, user_id))
            if not self._rooms[trip_id]:
                self._rooms.pop(trip_id, None)
            # 더 이상 어떤 trip에도 연결 안 됐으면 닉네임 캐시도 제거
            still_in = any(user_id == uid for room in self._rooms.values() for _, uid in room)
            if not still_in:
                self._nicknames.pop(user_id, None)
        try:
            await self.broadcast(
                trip_id,
                {
                    "type": "presence",
                    "event": "leave",
                    "user_id": user_id,
                    "active_users": await self.active_user_ids(trip_id),
                    "active": await self.active_users(trip_id),
                },
                exclude_ws=None,
            )
        except Exception:
            pass

    async def active_user_ids(self, trip_id: int) -> list[int]:
        """현재 로컬 워커에만 있는 user_id. 멀티워커 정확한 카운트는 Redis SET이 필요하지만,
        실용적으로 각 사용자가 한 워커에만 연결되므로 brief join/leave 이벤트로 동기화된다."""
        async with self._lock:
            return sorted({uid for _, uid in self._rooms.get(trip_id, set())})

    async def active_users(self, trip_id: int) -> list[dict[str, Any]]:
        """presence UI용 — id + nickname 쌍."""
        ids = await self.active_user_ids(trip_id)
        async with self._lock:
            return [{"id": uid, "nickname": self._nicknames.get(uid)} for uid in ids]

    # ── 브로드캐스트 ─────────────────────────────────────────────────────────

    async def broadcast(
        self, trip_id: int, message: dict[str, Any], *, exclude_ws: WebSocket | None
    ) -> None:
        """로컬 워커 fan-out + Redis publish (멀티 워커 환경에서 다른 워커도 fan-out)."""
        exclude_ws_id = id(exclude_ws) if exclude_ws is not None else None

        # 1) 로컬 fan-out
        await self._send_local(trip_id, message, exclude_ws_id=exclude_ws_id)

        # 2) Redis publish — 다른 워커들이 fan-out하도록
        if self._redis is not None:
            payload = dict(message)
            if exclude_ws_id is not None:
                payload["__origin_ws_id"] = exclude_ws_id
            try:
                await self._redis.publish(f"trip:{trip_id}", json.dumps(payload, default=str))
            except Exception as e:
                logger.warning("Redis publish failed: %s", e)

    async def _send_local(
        self,
        trip_id: int,
        message: dict[str, Any],
        *,
        exclude_ws_id: int | None,
    ) -> None:
        targets: list[WebSocket]
        async with self._lock:
            targets = [
                ws
                for ws, _ in self._rooms.get(trip_id, set())
                if exclude_ws_id is None or id(ws) != exclude_ws_id
            ]
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning("WS local send failed: %s", e)


manager = TripConnectionManager()
