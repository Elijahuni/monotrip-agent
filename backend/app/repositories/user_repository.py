from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    async def get_by_id(self, db: AsyncSession, user_id: int) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(
        self,
        db: AsyncSession,
        email: str,
        hashed_password: str,
        nickname: str,
    ) -> User:
        user = User(email=email, hashed_password=hashed_password, nickname=nickname)
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def update_push_token(
        self,
        db: AsyncSession,
        user_id: int,
        token: str | None,
    ) -> None:
        """Expo push token을 등록(token 문자열) 또는 제거(None)한다."""
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user is None:
            return
        user.expo_push_token = token
        db.add(user)
        await db.flush()
