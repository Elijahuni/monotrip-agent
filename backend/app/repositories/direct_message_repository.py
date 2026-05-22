"""다이렉트 메시지 데이터 접근 계층."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.direct_message import DirectMessage
from app.models.user import User


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class DirectMessageRepository:
    async def create(
        self, db: AsyncSession, sender_id: int, recipient_id: int, body: str
    ) -> DirectMessage:
        msg = DirectMessage(sender_id=sender_id, recipient_id=recipient_id, body=body)
        db.add(msg)
        await db.flush()
        await db.refresh(msg)
        return msg

    async def get_thread(
        self,
        db: AsyncSession,
        user_id: int,
        other_id: int,
        *,
        limit: int,
        cursor: int | None,
    ) -> list[DirectMessage]:
        """두 사용자 사이 메시지(최신순). cursor=마지막으로 받은 id(exclusive)."""
        stmt = (
            select(DirectMessage)
            .where(
                or_(
                    and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == other_id),
                    and_(DirectMessage.sender_id == other_id, DirectMessage.recipient_id == user_id),
                )
            )
            .order_by(desc(DirectMessage.id))
            .limit(limit)
        )
        if cursor:
            stmt = stmt.where(DirectMessage.id < cursor)
        return list((await db.execute(stmt)).scalars().all())

    async def mark_read(self, db: AsyncSession, user_id: int, other_id: int) -> None:
        """other_id가 보낸(=내가 받은) 미읽음 메시지를 읽음 처리."""
        stmt = (
            update(DirectMessage)
            .where(DirectMessage.recipient_id == user_id)
            .where(DirectMessage.sender_id == other_id)
            .where(DirectMessage.read_at.is_(None))
            .values(read_at=_utcnow_naive())
        )
        await db.execute(stmt)
        await db.flush()

    async def unread_count(self, db: AsyncSession, user_id: int) -> int:
        stmt = (
            select(func.count(DirectMessage.id))
            .where(DirectMessage.recipient_id == user_id)
            .where(DirectMessage.read_at.is_(None))
        )
        return (await db.execute(stmt)).scalar() or 0

    async def list_conversations(
        self, db: AsyncSession, user_id: int
    ) -> list[dict]:
        """사용자의 대화 목록 — 상대별 최신 메시지 + 미읽음 수 + 상대 닉네임.

        SQLite/PostgreSQL 모두에서 동작하도록 파이썬 측에서 그룹핑한다
        (메시지 수가 많지 않은 단계에서는 충분, 추후 윈도우 함수로 최적화 가능).
        """
        stmt = (
            select(DirectMessage)
            .where(or_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == user_id))
            .order_by(desc(DirectMessage.id))
        )
        rows = list((await db.execute(stmt)).scalars().all())

        convos: dict[int, dict] = {}
        for m in rows:
            other = m.recipient_id if m.sender_id == user_id else m.sender_id
            if other not in convos:
                convos[other] = {
                    "other_user_id": other,
                    "last_message": m.body,
                    "last_at": m.created_at,
                    "last_from_me": m.sender_id == user_id,
                    "unread_count": 0,
                }
            # 내가 받은 + 미읽음 카운트
            if m.recipient_id == user_id and m.read_at is None:
                convos[other]["unread_count"] += 1

        if not convos:
            return []

        # 상대 닉네임 일괄 조회
        ids = list(convos.keys())
        users = (await db.execute(select(User.id, User.nickname).where(User.id.in_(ids)))).all()
        nick = {uid: nm for uid, nm in users}
        for other, c in convos.items():
            c["other_nickname"] = nick.get(other)

        # 최신 대화 우선
        return sorted(convos.values(), key=lambda c: c["last_at"], reverse=True)
