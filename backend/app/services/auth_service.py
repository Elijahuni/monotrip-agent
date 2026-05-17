import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import RefreshRequest, TokenResponse, UserCreate, UserLogin, UserResponse

logger = logging.getLogger(__name__)


# ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_access_token(user_id: int) -> tuple[str, int]:
    """JWT access token 생성. (token_str, expires_in_seconds) 반환."""
    settings = get_settings()
    expire_seconds = settings.jwt_expire_minutes * 60
    expire = datetime.now(timezone.utc) + timedelta(seconds=expire_seconds)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expire_seconds


def _make_refresh_token() -> tuple[str, str]:
    """(raw_token, sha256_hash) 쌍 생성.
    raw_token은 클라이언트에만 전달, hash만 DB에 저장.
    """
    raw = secrets.token_hex(32)  # 256-bit 랜덤
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def _hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ─── Service ─────────────────────────────────────────────────────────────────


class AuthService:
    def __init__(
        self,
        repo: UserRepository | None = None,
        rt_repo: RefreshTokenRepository | None = None,
    ) -> None:
        self.repo = repo or UserRepository()
        self.rt_repo = rt_repo or RefreshTokenRepository()

    async def register(self, db: AsyncSession, data: UserCreate) -> UserResponse:
        existing = await self.repo.get_by_email(db, data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 사용 중인 이메일입니다.",
            )
        user = await self.repo.create(
            db,
            email=data.email,
            hashed_password=_hash_password(data.password),
            nickname=data.nickname,
        )
        logger.info("User registered: id=%s", user.id)
        return UserResponse.model_validate(user)

    async def issue_tokens(self, db: AsyncSession, user_id: int) -> TokenResponse:
        """이미 인증된 사용자에게 access + refresh 토큰 발급 (OAuth 등 재사용)."""
        access_token, expires_in = _create_access_token(user_id)
        raw_rt, rt_hash = _make_refresh_token()
        settings = get_settings()
        rt_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
        await self.rt_repo.create(db, user_id=user_id, token_hash=rt_hash, expires_at=rt_expires)
        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_rt,
            token_type="bearer",
            expires_in=expires_in,
        )

    async def login(self, db: AsyncSession, data: UserLogin) -> TokenResponse:
        user = await self.repo.get_by_email(db, data.email)
        # OAuth 사용자는 hashed_password가 None이므로 명시적으로 거부
        if (
            not user
            or user.hashed_password is None
            or not _verify_password(data.password, user.hashed_password)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이메일 또는 비밀번호가 올바르지 않습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token, expires_in = _create_access_token(user.id)
        raw_rt, rt_hash = _make_refresh_token()
        settings = get_settings()
        rt_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
        await self.rt_repo.create(db, user_id=user.id, token_hash=rt_hash, expires_at=rt_expires)

        logger.info("User logged in: id=%s", user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_rt,
            expires_in=expires_in,
        )

    async def refresh(self, db: AsyncSession, body: RefreshRequest) -> TokenResponse:
        """Refresh token rotation — 기존 토큰을 폐기하고 새 쌍을 발급.

        재사용 감지(revoked 토큰 제출) 시 401 반환.
        (유효한 refresh token은 사용 즉시 폐기되므로 다시 제출되면 탈취 의심)
        """
        rt_hash = _hash_refresh_token(body.refresh_token)
        rt = await self.rt_repo.get_valid(db, rt_hash)

        if rt is None:
            logger.warning("Invalid or expired refresh token submitted")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 refresh token입니다. 다시 로그인해 주세요.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Rotation: 기존 폐기 → 새 쌍 발급
        await self.rt_repo.revoke(db, rt)

        access_token, expires_in = _create_access_token(rt.user_id)
        raw_rt, new_rt_hash = _make_refresh_token()
        settings = get_settings()
        rt_expires = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
        await self.rt_repo.create(
            db, user_id=rt.user_id, token_hash=new_rt_hash, expires_at=rt_expires
        )

        logger.info("Token refreshed: user_id=%s", rt.user_id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=raw_rt,
            expires_in=expires_in,
        )

    async def logout(self, db: AsyncSession, user_id: int) -> None:
        """현재 사용자의 모든 refresh token 폐기."""
        await self.rt_repo.revoke_all_for_user(db, user_id)
        logger.info("User logged out: id=%s", user_id)
