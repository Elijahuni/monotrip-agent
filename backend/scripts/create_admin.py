"""
관리자 계정 생성 스크립트
사용법: uv run python scripts/create_admin.py

백엔드 서버 없이 DB에 직접 연결해서 계정을 만듭니다.
"""

import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가 (app 모듈 임포트용)
sys.path.insert(0, str(Path(__file__).parent.parent))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.user import User
from app.database import Base

# ── 생성할 계정 정보 ──────────────────────────────────────────────────────────
ADMIN_EMAIL    = "admin@gmail.com"
ADMIN_PASSWORD = "admin1234"
ADMIN_NICKNAME = "관리자"
# ─────────────────────────────────────────────────────────────────────────────


async def main() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        # 테이블이 없으면 자동 생성
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        # 이미 존재하면 스킵
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        existing = result.scalars().first()

        if existing:
            print(f"⚠️  이미 존재하는 계정입니다: {ADMIN_EMAIL} (id={existing.id})")
            print("    비밀번호를 재설정하려면 --reset 플래그를 사용하세요.")
            if "--reset" in sys.argv:
                hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
                existing.hashed_password = hashed
                await db.commit()
                print(f"✅  비밀번호가 재설정되었습니다: {ADMIN_EMAIL}")
            await engine.dispose()
            return

        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        user = User(
            email=ADMIN_EMAIL,
            hashed_password=hashed,
            nickname=ADMIN_NICKNAME,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        print("✅  관리자 계정이 생성되었습니다!")
        print(f"   이메일  : {ADMIN_EMAIL}")
        print(f"   비밀번호: {ADMIN_PASSWORD}")
        print(f"   닉네임  : {ADMIN_NICKNAME}")
        print(f"   ID      : {user.id}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
