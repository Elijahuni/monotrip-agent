from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.user import RefreshRequest, TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService
from app.services.google_oauth import upsert_google_user, verify_google_id_token
from app.services.kakao_oauth import (
    exchange_code_for_token,
    fetch_kakao_profile,
    upsert_kakao_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_service = AuthService()


@router.post("/register", response_model=ApiResponse[UserResponse], status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, body: UserCreate, db: DbSession) -> ApiResponse[UserResponse]:
    user = await _service.register(db, body)
    return ApiResponse(data=user)


@router.post("/login", response_model=ApiResponse[TokenResponse])
@limiter.limit("5/minute")
async def login(request: Request, body: UserLogin, db: DbSession) -> ApiResponse[TokenResponse]:
    token = await _service.login(db, body)
    return ApiResponse(data=token)


class KakaoLoginRequest(BaseModel):
    """모바일이 카카오 SDK로 access_token을 받으면 그대로 전달.
    웹/대안 흐름: code만 받으면 백엔드가 token으로 교환."""

    access_token: str | None = Field(default=None, min_length=10)
    code: str | None = Field(default=None, min_length=4)


@router.post("/kakao", response_model=ApiResponse[TokenResponse])
@limiter.limit("10/minute")
async def kakao_login(
    request: Request,
    body: KakaoLoginRequest,
    db: DbSession,
) -> ApiResponse[TokenResponse]:
    """카카오 OAuth 로그인. access_token이 있으면 그대로 사용, 없으면 code 교환."""
    if not body.access_token and not body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="access_token 또는 code 중 하나는 필수입니다.",
        )

    access_token = body.access_token or await exchange_code_for_token(body.code or "")
    profile = await fetch_kakao_profile(access_token)
    user = await upsert_kakao_user(db, profile)
    tokens = await _service.issue_tokens(db, user.id)
    return ApiResponse(data=tokens)


class GoogleLoginRequest(BaseModel):
    """expo-auth-session이 Google 로그인 후 반환하는 id_token 전달."""

    id_token: str = Field(min_length=10)


@router.post("/google", response_model=ApiResponse[TokenResponse])
@limiter.limit("10/minute")
async def google_login(
    request: Request,
    body: GoogleLoginRequest,
    db: DbSession,
) -> ApiResponse[TokenResponse]:
    """Google OAuth 로그인.

    모바일에서 expo-auth-session으로 획득한 id_token을 검증하고
    사용자 upsert 후 triple JWT를 발급합니다.
    """
    profile = await verify_google_id_token(body.id_token)
    user = await upsert_google_user(db, profile)
    tokens = await _service.issue_tokens(db, user.id)
    return ApiResponse(data=tokens)


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
@limiter.limit("30/minute")
async def refresh_token(
    request: Request, body: RefreshRequest, db: DbSession
) -> ApiResponse[TokenResponse]:
    """Refresh token으로 새 access token + 새 refresh token 발급 (rotation).

    클라이언트는 401 응답 시 이 엔드포인트를 자동 호출하고,
    실패 시 로그인 화면으로 이동해야 합니다.
    """
    token = await _service.refresh(db, body)
    return ApiResponse(data=token)


@router.post("/logout", response_model=ApiResponse[None])
async def logout(current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    """현재 사용자의 모든 refresh token 폐기 (전 기기 로그아웃)."""
    await _service.logout(db, current_user.id)
    return ApiResponse(data=None)


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(current_user: CurrentUser) -> ApiResponse[UserResponse]:
    return ApiResponse(data=UserResponse.model_validate(current_user))
