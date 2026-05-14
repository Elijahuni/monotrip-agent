"""
테스트 픽스처
- SQLite in-memory AsyncEngine (PostgreSQL 대신)
- httpx AsyncClient (FastAPI TestClient 대체)
- 더미 유저 생성 헬퍼
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

# ── SQLite in-memory DB ──────────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """테스트 세션 전체에 걸쳐 테이블 한 번만 생성."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """각 테스트에서 독립 DB 세션 제공. 테스트 후 롤백."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """FastAPI 앱에 테스트 DB 세션 주입 후 AsyncClient 제공."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ── 더미 유저 헬퍼 ────────────────────────────────────────────────────────────

TEST_USER = {
    "email": "testuser@example.com",
    "password": "testpass123",
    "nickname": "테스터",
}


async def register_and_login(client: AsyncClient, email: str = TEST_USER["email"],
                             password: str = TEST_USER["password"],
                             nickname: str = TEST_USER["nickname"]) -> str:
    """회원가입 → 로그인 → access_token 반환."""
    await client.post("/auth/register", json={"email": email, "password": password, "nickname": nickname})
    res = await client.post("/auth/login", json={"email": email, "password": password})
    return res.json()["data"]["access_token"]
