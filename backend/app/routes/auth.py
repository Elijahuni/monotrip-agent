from fastapi import APIRouter, Request

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.user import RefreshRequest, TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

_service = AuthService()


@router.post("/register", response_model=ApiResponse[UserResponse], status_code=201)
@limiter.limit("3/minute")
async def register(
    request: Request, body: UserCreate, db: DbSession
) -> ApiResponse[UserResponse]:
    user = await _service.register(db, body)
    return ApiResponse(data=user)


@router.post("/login", response_model=ApiResponse[TokenResponse])
@limiter.limit("5/minute")
async def login(
    request: Request, body: UserLogin, db: DbSession
) -> ApiResponse[TokenResponse]:
    token = await _service.login(db, body)
    return ApiResponse(data=token)


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
