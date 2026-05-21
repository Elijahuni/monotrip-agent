from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select, update
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.community import CommunityPost
from app.models.user import User
from app.models.saved_place import SavedPlace
from app.models.trip import Trip
from app.schemas.common import ApiResponse
from app.schemas.user import (
    GamificationResponse,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserStatsResponse,
    UserUpdateRequest,
    UserUpdateResponse,
)
from app.services.auth_service import AuthService
from app.services.gamification_service import evaluate_and_award_badges, get_user_gamification
from app.services.apple_oauth import upsert_apple_user, verify_apple_identity_token
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


class AppleLoginRequest(BaseModel):
    """expo-apple-authentication이 반환하는 identityToken을 전달.

    full_name은 Apple이 최초 로그인 시에만 전달하므로 선택적.
    """

    identity_token: str = Field(min_length=10)
    full_name: str | None = Field(default=None, max_length=100)


@router.post("/apple", response_model=ApiResponse[TokenResponse])
@limiter.limit("10/minute")
async def apple_login(
    request: Request,
    body: AppleLoginRequest,
    db: DbSession,
) -> ApiResponse[TokenResponse]:
    """Apple Sign In.

    모바일에서 expo-apple-authentication으로 획득한 identityToken을 검증하고
    사용자 upsert 후 triple JWT를 발급합니다.
    """
    profile = await verify_apple_identity_token(body.identity_token)
    user = await upsert_apple_user(db, profile, full_name=body.full_name)
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


@router.patch("/me", response_model=ApiResponse[UserUpdateResponse])
async def update_me(
    body: UserUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[UserUpdateResponse]:
    """닉네임·프로필 이미지 수정."""
    if body.nickname is None and body.profile_image_url is None:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다.")

    # 닉네임 중복 체크
    if body.nickname and body.nickname != current_user.nickname:
        dup = (
            await db.execute(
                select(User).where(User.nickname == body.nickname, User.id != current_user.id)
            )
        ).scalars().first()
        if dup:
            raise HTTPException(status_code=409, detail="이미 사용 중인 닉네임입니다.")

    values: dict = {}
    if body.nickname is not None:
        values["nickname"] = body.nickname
    if body.profile_image_url is not None:
        values["profile_image_url"] = body.profile_image_url

    await db.execute(update(User).where(User.id == current_user.id).values(**values))
    await db.commit()

    # 최신 데이터 반환
    updated = (await db.execute(select(User).where(User.id == current_user.id))).scalars().first()
    return ApiResponse(data=UserUpdateResponse.model_validate(updated))


@router.get("/me/stats", response_model=ApiResponse[UserStatsResponse])
async def get_my_stats(current_user: CurrentUser, db: DbSession) -> ApiResponse[UserStatsResponse]:
    """내 여행·저장·게시글·리뷰 개수를 한 번에 반환."""
    uid = current_user.id

    trip_count = (
        await db.execute(select(func.count(Trip.id)).where(Trip.user_id == uid))
    ).scalar() or 0

    saved_count = (
        await db.execute(select(func.count(SavedPlace.id)).where(SavedPlace.user_id == uid))
    ).scalar() or 0

    post_count = (
        await db.execute(
            select(func.count(CommunityPost.id))
            .where(CommunityPost.user_id == uid)
            .where(CommunityPost.is_hidden.is_(False))
        )
    ).scalar() or 0

    # 리뷰 = review 카테고리 게시글 수
    review_count = (
        await db.execute(
            select(func.count(CommunityPost.id))
            .where(CommunityPost.user_id == uid)
            .where(CommunityPost.category == "review")
            .where(CommunityPost.is_hidden.is_(False))
        )
    ).scalar() or 0

    return ApiResponse(
        data=UserStatsResponse(
            trip_count=trip_count,
            saved_count=saved_count,
            post_count=post_count,
            review_count=review_count,
        )
    )


@router.get("/me/gamification", response_model=ApiResponse[GamificationResponse])
async def get_my_gamification(current_user: CurrentUser, db: DbSession) -> ApiResponse[GamificationResponse]:
    """내 XP·레벨·배지 현황을 반환하고, 새로 획득한 배지를 자동 수여."""
    # 새 배지 수여 (이미 있으면 skip) → flush만, commit은 dependency에서 처리
    await evaluate_and_award_badges(db, current_user.id, current_user.created_at)
    await db.commit()

    data = await get_user_gamification(db, current_user.id, current_user.created_at)
    return ApiResponse(data=GamificationResponse(**data))
