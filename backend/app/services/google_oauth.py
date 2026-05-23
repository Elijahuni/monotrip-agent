"""Google OAuth — ID Token 검증 + 사용자 upsert.

모바일 흐름 (expo-auth-session):
  1) 모바일에서 expo-auth-session으로 Google 로그인 → id_token 획득
  2) 모바일이 /auth/google 로 id_token 전송
  3) 백엔드가 Google tokeninfo API로 검증 → user upsert → triple JWT 발급

id_token 검증 방법:
  GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>
  → 응답에 sub(Google UID), email, name, picture 포함
  → aud(audience) = Google Client ID 일치 여부 필수 확인

설정 필요:
  GOOGLE_CLIENT_ID   — Google Cloud Console → OAuth 2.0 클라이언트 ID
                       (iOS/Android/Web 각각 발급, 검증은 Web 클라이언트 ID 사용)
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_id_token(id_token: str) -> dict[str, Any]:
    """Google tokeninfo 엔드포인트로 id_token 검증 후 프로필 반환.

    반환 키: sub, email, name, picture, email_verified
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(_TOKENINFO_URL, params={"id_token": id_token})
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.warning("Google tokeninfo failed status=%d: %s", e.response.status_code, e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 Google 토큰이에요.",
            )
        except httpx.HTTPError as e:
            logger.warning("Google tokeninfo network error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google 인증 서버에 연결할 수 없어요.",
            )

    # 오류 응답 (만료 토큰 등)
    if "error" in data or "error_description" in data:
        logger.warning("Google tokeninfo error: %s", data)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="만료되거나 유효하지 않은 Google 토큰이에요.",
        )

    # Audience 검증 — google_client_id 설정이 있을 때만 강제
    settings = get_settings()
    if settings.google_client_id:
        aud = data.get("aud", "")
        if aud not in (
            settings.google_client_id,
            settings.google_ios_client_id,
            settings.google_android_client_id,
        ):
            logger.warning("Google token audience mismatch: aud=%s", aud)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="이 앱의 Google 토큰이 아니에요.",
            )

    google_uid = data.get("sub")
    if not google_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google 계정 정보를 가져올 수 없어요.",
        )

    email = data.get("email")
    name = data.get("name") or data.get("given_name") or f"구글유저{google_uid[-4:]}"
    picture = data.get("picture")

    return {
        "provider": "google",
        "provider_user_id": google_uid,
        "email": email,
        "nickname": name,
        "profile_image_url": picture,
    }


async def upsert_google_user(db: AsyncSession, profile: dict[str, Any]) -> User:
    """Google 프로필 → User 매칭/생성.

    우선순위:
      1) provider="google" + provider_user_id 일치하는 기존 OAuth 사용자
      2) email 일치하는 기존 사용자에 Google 연동 (계정 통합)
      3) 신규 Google 사용자 생성
    """
    pid = profile["provider_user_id"]

    # 1) Google UID로 기존 사용자 조회
    existing = (
        (
            await db.execute(
                select(User)
                .where(User.auth_provider == "google")
                .where(User.provider_user_id == pid)
            )
        )
        .scalars()
        .first()
    )
    if existing:
        # 닉네임/프로필 이미지 동기화
        if profile.get("nickname") and existing.nickname != profile["nickname"]:
            existing.nickname = profile["nickname"]
        if profile.get("profile_image_url") and not existing.profile_image_url:
            existing.profile_image_url = profile["profile_image_url"]
        await db.flush()
        return existing

    # 2) 같은 email의 기존 사용자 → Google로 연동
    email = profile.get("email")
    if email:
        same_email = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if same_email:
            same_email.auth_provider = "google"
            same_email.provider_user_id = pid
            if profile.get("profile_image_url") and not same_email.profile_image_url:
                same_email.profile_image_url = profile["profile_image_url"]
            await db.flush()
            return same_email

    # 3) 신규 Google 사용자 생성
    placeholder_email = email or f"google+{pid}@triple.local"
    new_user = User(
        email=placeholder_email,
        hashed_password=None,
        nickname=profile["nickname"],
        profile_image_url=profile.get("profile_image_url"),
        auth_provider="google",
        provider_user_id=pid,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user
