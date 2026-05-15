from fastapi import APIRouter, Request

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
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


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(current_user: CurrentUser) -> ApiResponse[UserResponse]:
    return ApiResponse(data=UserResponse.model_validate(current_user))
