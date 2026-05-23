"""Apple Sign In — identity_token 검증 + 사용자 upsert.

모바일 흐름 (expo-apple-authentication):
  1) 모바일에서 expo-apple-authentication으로 로그인 →
     identityToken, user(안정적 uid), fullName, email 획득
  2) 모바일이 /auth/apple 로 identity_token 전달
  3) 백엔드가 Apple 공개키로 JWT 검증 → user upsert → triple JWT 발급

identity_token 검증:
  - Apple JWKS(https://appleid.apple.com/auth/keys)에서 공개키 목록 조회
  - kid(Key ID)로 해당 JWK 선택 → python-jose의 jwk 모듈로 RS256 검증

설정 필요:
  APPLE_CLIENT_ID  — Apple Developer → Identifiers → App ID의 Bundle ID
                     (예: com.yourcompany.triple). 비어있으면 audience 검증 생략.

의존성:
  python-jose[cryptography]  — 이미 pyproject.toml에 포함됨.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt
from jose.backends import RSAKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

_APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_APPLE_ISS = "https://appleid.apple.com"

# 공개키 캐시 (프로세스 수명 동안 재사용)
_cached_keys: dict[str, dict[str, Any]] | None = None


async def _fetch_apple_public_keys() -> dict[str, dict[str, Any]]:
    """Apple JWKS에서 공개키 목록 → kid → JWK dict 변환."""
    global _cached_keys
    if _cached_keys is not None:
        return _cached_keys

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(_APPLE_KEYS_URL)
            resp.raise_for_status()
            jwks = resp.json()
        except httpx.HTTPError as e:
            logger.error("Apple JWKS fetch failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Apple 인증 서버에 연결할 수 없어요.",
            )

    _cached_keys = {key["kid"]: key for key in jwks.get("keys", [])}
    return _cached_keys


def _get_unverified_header(token: str) -> dict[str, Any]:
    """JWT 헤더를 서명 검증 없이 파싱."""
    import base64

    header_b64 = token.split(".")[0]
    # base64url 패딩 보정
    padding = 4 - len(header_b64) % 4
    if padding != 4:
        header_b64 += "=" * padding
    header_bytes = base64.urlsafe_b64decode(header_b64)
    return json.loads(header_bytes)


async def verify_apple_identity_token(identity_token: str) -> dict[str, Any]:
    """Apple identity_token을 RS256으로 검증하고 클레임을 반환.

    반환 키: sub (Apple UID), email, email_verified
    """
    try:
        header = _get_unverified_header(identity_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Apple 토큰 헤더를 읽을 수 없어요: {e}",
        )

    kid = header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple 토큰에 kid 클레임이 없어요.",
        )

    keys = await _fetch_apple_public_keys()
    if kid not in keys:
        # 키 캐시 무효화 후 재시도
        global _cached_keys
        _cached_keys = None
        keys = await _fetch_apple_public_keys()

    if kid not in keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple 공개키를 찾을 수 없어요.",
        )

    jwk_dict = keys[kid]

    # JWK → python-jose RSAKey → PEM 공개키
    try:
        rsa_key = RSAKey(jwk_dict, algorithm="RS256")
        public_key_pem = rsa_key.public_key().to_pem().decode("utf-8")
    except Exception as e:
        logger.error("Apple JWK to RSA conversion failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Apple 공개키 변환에 실패했어요.",
        )

    settings = get_settings()
    audience = settings.apple_client_id if settings.apple_client_id else None

    try:
        options = {
            "verify_aud": bool(audience),
            "verify_iss": True,
            "verify_exp": True,
        }
        claims = jwt.decode(
            identity_token,
            public_key_pem,
            algorithms=["RS256"],
            audience=audience,
            issuer=_APPLE_ISS,
            options=options,
        )
    except JWTError as e:
        logger.warning("Apple token verification failed: %s", e)
        error_str = str(e).lower()
        if "expired" in error_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Apple 토큰이 만료됐어요.",
            )
        if "audience" in error_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이 앱의 Apple 토큰이 아니에요.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Apple 토큰이에요.",
        )

    apple_uid = claims.get("sub")
    if not apple_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple 계정 정보를 가져올 수 없어요.",
        )

    email = claims.get("email")
    return {
        "provider": "apple",
        "provider_user_id": apple_uid,
        "email": email,
    }


async def upsert_apple_user(
    db: AsyncSession,
    profile: dict[str, Any],
    full_name: str | None = None,
) -> User:
    """Apple 프로필 → User 매칭/생성.

    full_name은 Apple이 최초 로그인 시 한 번만 전달하므로 선택적으로 받음.

    우선순위:
      1) provider="apple" + provider_user_id 일치
      2) email 일치 → Apple 연동 (계정 통합)
      3) 신규 Apple 사용자 생성
    """
    pid = profile["provider_user_id"]

    # 1) Apple UID로 기존 사용자 조회
    existing = (
        (
            await db.execute(
                select(User)
                .where(User.auth_provider == "apple")
                .where(User.provider_user_id == pid)
            )
        )
        .scalars()
        .first()
    )
    if existing:
        # full_name은 최초 로그인에만 넘어옴 — 기존 닉네임이 placeholder면 업데이트
        if full_name and (not existing.nickname or existing.nickname.startswith("애플유저")):
            existing.nickname = full_name
            await db.flush()
        return existing

    # 2) 같은 email의 기존 사용자 → Apple로 연동
    email = profile.get("email")
    if email:
        same_email = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if same_email:
            same_email.auth_provider = "apple"
            same_email.provider_user_id = pid
            await db.flush()
            return same_email

    # 3) 신규 Apple 사용자 생성
    nickname = full_name or f"애플유저{pid[-4:]}"
    placeholder_email = email or f"apple+{pid}@triple.local"
    new_user = User(
        email=placeholder_email,
        hashed_password=None,
        nickname=nickname,
        profile_image_url=None,
        auth_provider="apple",
        provider_user_id=pid,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user
