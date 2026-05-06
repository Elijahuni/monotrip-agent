from fastapi import APIRouter

from app.dependencies.db import DbSession
from app.schemas.common import ApiResponse
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

_service = AuthService()


@router.post("/register", response_model=ApiResponse[UserResponse], status_code=201)
async def register(body: UserCreate, db: DbSession) -> ApiResponse[UserResponse]:
    user = await _service.register(db, body)
    return ApiResponse(data=user)


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(body: UserLogin, db: DbSession) -> ApiResponse[TokenResponse]:
    token = await _service.login(db, body)
    return ApiResponse(data=token)
