"""카카오 OAuth — authorization_code 교환 + 프로필 조회 + 토큰 발급.

모바일 흐름:
  1) 모바일에서 카카오 SDK로 로그인 → access_token 또는 authorization_code 획득
  2) 모바일이 /auth/kakao로 access_token(또는 code) 전송
  3) 백엔드가 카카오 API로 프로필 조회 → user upsert → triple JWT 발급
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

_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
_PROFILE_URL = "https://kapi.kakao.com/v2/user/me"


async def exchange_code_for_token(code: str) -> str:
    """authorization_code → access_token. 카카오 토큰 엔드포인트 호출."""
    settings = get_settings()
    if not settings.kakao_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="카카오 로그인이 설정되어 있지 않아요.",
        )

    data = {
        "grant_type": "authorization_code",
        "client_id": settings.kakao_client_id,
        "redirect_uri": settings.kakao_redirect_uri,
        "code": code,
    }
    if settings.kakao_client_secret:
        data["client_secret"] = settings.kakao_client_secret

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(_TOKEN_URL, data=data)
            resp.raise_for_status()
            payload = resp.json()
        except httpx.HTTPError as e:
            logger.warning("Kakao token exchange failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="카카오 인증에 실패했어요.",
            )

    access_token = payload.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="카카오 응답이 비어있어요."
        )
    return access_token


async def fetch_kakao_profile(access_token: str) -> dict[str, Any]:
    """access_token으로 카카오 프로필 조회. id / nickname / email / profile_image_url."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                _PROFILE_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            payload = resp.json()
        except httpx.HTTPError as e:
            logger.warning("Kakao profile fetch failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="카카오 프로필을 가져올 수 없어요.",
            )

    kakao_id = payload.get("id")
    if kakao_id is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="카카오 응답 형식 오류")

    kakao_account = payload.get("kakao_account", {})
    profile = kakao_account.get("profile", {})
    email = kakao_account.get("email")
    nickname = profile.get("nickname") or f"카카오{kakao_id}"
    profile_image = profile.get("profile_image_url")

    return {
        "provider_user_id": str(kakao_id),
        "email": email,
        "nickname": nickname,
        "profile_image_url": profile_image,
    }


async def upsert_kakao_user(db: AsyncSession, profile: dict[str, Any]) -> User:
    """카카오 프로필 → User 매칭/생성.

    우선순위:
      1) provider="kakao" + provider_user_id 일치하는 기존 OAuth 사용자
      2) email이 있으면 같은 email의 local 사용자에 연동 (계정 통합)
      3) 새 OAuth 사용자 생성
    """
    pid = profile["provider_user_id"]

    # 1) OAuth 식별자로 조회
    existing = (
        (
            await db.execute(
                select(User)
                .where(User.auth_provider == "kakao")
                .where(User.provider_user_id == pid)
            )
        )
        .scalars()
        .first()
    )
    if existing:
        # 닉네임/이미지가 바뀌었을 수 있으니 동기화
        if profile.get("nickname") and existing.nickname != profile["nickname"]:
            existing.nickname = profile["nickname"]
        if profile.get("profile_image_url"):
            existing.profile_image_url = profile["profile_image_url"]
        await db.flush()
        return existing

    # 2) 같은 email의 local 사용자 → 카카오로 연동
    email = profile.get("email")
    if email:
        same_email = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if same_email:
            same_email.auth_provider = "kakao"
            same_email.provider_user_id = pid
            if profile.get("profile_image_url") and not same_email.profile_image_url:
                same_email.profile_image_url = profile["profile_image_url"]
            await db.flush()
            return same_email

    # 3) 신규 생성. 이메일 없으면 placeholder 사용 (카카오는 이메일 제공이 옵션)
    placeholder_email = email or f"kakao+{pid}@triple.local"
    new_user = User(
        email=placeholder_email,
        hashed_password=None,
        nickname=profile["nickname"],
        profile_image_url=profile.get("profile_image_url"),
        auth_provider="kakao",
        provider_user_id=pid,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    return new_user
