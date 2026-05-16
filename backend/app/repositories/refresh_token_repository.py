"""RefreshToken CRUD — DB 기반 refresh token 관리."""
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    async def create(
        self,
        db: AsyncSession,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshToken:
        rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        db.add(rt)
        await db.flush()
        await db.refresh(rt)
        return rt

    async def get_valid(self, db: AsyncSession, token_hash: str) -> RefreshToken | None:
        """hash 일치 + 미만료 + 미폐기 토큰 조회."""
        now = datetime.now(timezone.utc)
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > now,
            RefreshToken.revoked_at.is_(None),
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def revoke(self, db: AsyncSession, rt: RefreshToken) -> None:
        rt.revoked_at = datetime.now(timezone.utc)
        db.add(rt)
        await db.flush()

    async def revoke_all_for_user(self, db: AsyncSession, user_id: int) -> None:
        """로그아웃 등 모든 기기 세션 무효화."""
        now = datetime.now(timezone.utc)
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.flush()
