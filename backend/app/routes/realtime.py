"""실시간 협업 WebSocket 라우트.

연결: GET ws://.../ws/trips/{trip_id}?token=<access_token>
- access_token 검증 (HTTP 헤더 대신 query parameter)
- 사용자가 trip owner 또는 협업자인지 확인
- 클라이언트가 보낸 op 메시지를 같은 방의 다른 참여자에게 브로드캐스트
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.collaboration_service import CollaborationService
from app.services.realtime import manager

router = APIRouter(tags=["realtime"])
logger = logging.getLogger(__name__)
_collab = CollaborationService()


async def _decode_token(token: str) -> int | None:
    """JWT access token에서 user_id 추출. 실패하면 None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (JWTError, ValueError):
        return None


@router.websocket("/ws/trips/{trip_id}")
async def trip_websocket(
    ws: WebSocket,
    trip_id: int,
    token: str = Query(min_length=10),
) -> None:
    # 1) 토큰 디코드
    user_id = await _decode_token(token)
    if user_id is None:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2) 권한 확인 + 닉네임 조회 (별도 세션)
    db: AsyncSession
    nickname: str | None = None
    async with AsyncSessionLocal() as db:
        has_access = await _collab.user_has_edit_access(db, trip_id=trip_id, user_id=user_id)
        if has_access:
            user = await db.get(User, user_id)
            nickname = user.nickname if user else None
    if not has_access:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    await manager.connect(trip_id, ws, user_id, nickname=nickname)
    try:
        while True:
            msg = await ws.receive_json()
            # 클라이언트가 보내는 메시지 형식 (예시):
            # { type: 'location_update', op: 'create'|'patch'|'delete', payload: {...} }
            # { type: 'cursor', payload: { day_index, location_id } }
            if not isinstance(msg, dict) or "type" not in msg:
                continue
            # 발신자 user_id를 자동 포함 (스푸핑 방지)
            msg["from_user_id"] = user_id
            await manager.broadcast(trip_id, msg, exclude_ws=ws)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("WS error trip=%s user=%s: %s", trip_id, user_id, e)
    finally:
        await manager.disconnect(trip_id, ws, user_id)
