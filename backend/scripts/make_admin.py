"""관리자 계정 생성/승격 스크립트.

사용법:
  uv run python scripts/make_admin.py --email admin@example.com

옵션:
  --email   대상 유저 이메일 (필수)
  --demote  관리자 → 일반회원 강등
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.user import User, UserRole


async def main(email: str, demote: bool) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if not user:
            print(f"❌ 유저를 찾을 수 없습니다: {email}")
            return

        new_role = UserRole.USER if demote else UserRole.ADMIN
        await db.execute(update(User).where(User.id == user.id).values(role=new_role))
        await db.commit()

        action = "강등" if demote else "승격"
        print(f"✅ {user.nickname} ({email}) → role={new_role} ({action} 완료)")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="관리자 역할 설정")
    parser.add_argument("--email", required=True, help="대상 유저 이메일")
    parser.add_argument("--demote", action="store_true", help="관리자 → 일반 강등")
    args = parser.parse_args()
    asyncio.run(main(args.email, args.demote))
