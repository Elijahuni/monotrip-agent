"""여행 공동 편집 — 초대 발급/수락, 협업자 관리."""

import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip_collaborator import TripCollaborator, TripInvite
from app.repositories.trip_repository import TripRepository

_INVITE_TTL = timedelta(days=7)


class CollaborationService:
    def __init__(self) -> None:
        self.trip_repo = TripRepository()

    async def assert_can_invite(self, db: AsyncSession, trip_id: int, user_id: int) -> None:
        """초대 권한 검증: trip owner 또는 기존 협업자."""
        trip = await self.trip_repo.get_by_id(db, trip_id)
        if trip is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다."
            )
        if trip.user_id == user_id:
            return
        is_collab = (
            (
                await db.execute(
                    select(TripCollaborator)
                    .where(TripCollaborator.trip_id == trip_id)
                    .where(TripCollaborator.user_id == user_id)
                )
            )
            .scalars()
            .first()
        )
        if is_collab is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="초대 권한이 없습니다."
            )

    async def create_invite(
        self, db: AsyncSession, *, trip_id: int, inviter_id: int, role: str = "edit"
    ) -> TripInvite:
        await self.assert_can_invite(db, trip_id, inviter_id)
        if role not in ("edit", "view"):
            role = "edit"
        token = secrets.token_urlsafe(32)
        invite = TripInvite(
            trip_id=trip_id,
            inviter_id=inviter_id,
            token=token,
            role=role,
            expires_at=datetime.utcnow() + _INVITE_TTL,
        )
        db.add(invite)
        await db.flush()
        await db.refresh(invite)
        return invite

    async def accept_invite(
        self, db: AsyncSession, *, token: str, user_id: int
    ) -> TripCollaborator:
        invite = (
            (await db.execute(select(TripInvite).where(TripInvite.token == token)))
            .scalars()
            .first()
        )
        if invite is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="유효하지 않은 초대 링크입니다."
            )
        if invite.accepted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_410_GONE, detail="이미 사용된 초대 링크입니다."
            )
        if invite.expires_at < datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="만료된 초대 링크입니다.")

        trip = await self.trip_repo.get_by_id(db, invite.trip_id)
        if trip is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다."
            )
        # 본인 여행은 협업자로 추가 불가
        if trip.user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="본인 여행에는 참여할 수 없어요."
            )

        # 이미 협업자면 멱등 (단순 invite만 소진)
        existing = (
            (
                await db.execute(
                    select(TripCollaborator)
                    .where(TripCollaborator.trip_id == invite.trip_id)
                    .where(TripCollaborator.user_id == user_id)
                )
            )
            .scalars()
            .first()
        )
        if existing is not None:
            invite.accepted_at = datetime.utcnow()
            invite.accepted_by_user_id = user_id
            await db.flush()
            return existing

        collab = TripCollaborator(
            trip_id=invite.trip_id,
            user_id=user_id,
            role=invite.role,
        )
        db.add(collab)
        invite.accepted_at = datetime.utcnow()
        invite.accepted_by_user_id = user_id
        await db.flush()
        await db.refresh(collab)
        return collab

    async def list_collaborators(self, db: AsyncSession, trip_id: int) -> list[TripCollaborator]:
        rows = await db.execute(select(TripCollaborator).where(TripCollaborator.trip_id == trip_id))
        return list(rows.scalars().all())

    async def user_has_edit_access(self, db: AsyncSession, *, trip_id: int, user_id: int) -> bool:
        """trip owner이거나 edit 권한 협업자인지."""
        trip = await self.trip_repo.get_by_id(db, trip_id)
        if trip is None:
            return False
        if trip.user_id == user_id:
            return True
        collab = (
            (
                await db.execute(
                    select(TripCollaborator)
                    .where(TripCollaborator.trip_id == trip_id)
                    .where(TripCollaborator.user_id == user_id)
                )
            )
            .scalars()
            .first()
        )
        return collab is not None and collab.role in ("edit", "owner")
