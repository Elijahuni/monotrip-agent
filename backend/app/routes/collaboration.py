"""공동 편집 초대/수락/협업자 목록 라우트."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.collaboration_service import CollaborationService

router = APIRouter(tags=["collaboration"])
_service = CollaborationService()


class InviteCreateBody(BaseModel):
    role: Literal["edit", "view"] = "edit"


class InviteResponse(BaseModel):
    token: str
    role: str
    expires_at: datetime
    share_url: str  # 카카오톡 등에 그대로 붙여넣을 URL


class AcceptInviteBody(BaseModel):
    token: str = Field(min_length=10, max_length=128)


class CollaboratorResponse(BaseModel):
    user_id: int
    role: str
    joined_at: datetime
    model_config = {"from_attributes": True}


def _share_url(token: str) -> str:
    settings = get_settings()
    # mobile deep link은 expo router 경로. 웹 폴백은 share token 페이지 활용.
    base = getattr(settings, "public_base_url", None) or "https://triple.app"
    return f"{base}/trips/invite/{token}"


@router.post(
    "/trips/{trip_id}/invite",
    response_model=ApiResponse[InviteResponse],
    status_code=201,
)
@limiter.limit("20/hour")
async def create_invite(
    request: Request,
    trip_id: int,
    body: InviteCreateBody,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[InviteResponse]:
    invite = await _service.create_invite(
        db, trip_id=trip_id, inviter_id=current_user.id, role=body.role
    )
    return ApiResponse(
        data=InviteResponse(
            token=invite.token,
            role=invite.role,
            expires_at=invite.expires_at,
            share_url=_share_url(invite.token),
        )
    )


@router.post("/trips/invite/accept", response_model=ApiResponse[CollaboratorResponse])
@limiter.limit("30/hour")
async def accept_invite(
    request: Request,
    body: AcceptInviteBody,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[CollaboratorResponse]:
    collab = await _service.accept_invite(db, token=body.token, user_id=current_user.id)
    return ApiResponse(data=CollaboratorResponse.model_validate(collab))


@router.get(
    "/trips/{trip_id}/collaborators",
    response_model=ApiResponse[list[CollaboratorResponse]],
)
async def list_collaborators(
    trip_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[CollaboratorResponse]]:
    # 협업자 목록은 owner와 협업자만 조회 가능
    await _service.assert_can_invite(db, trip_id, current_user.id)
    rows = await _service.list_collaborators(db, trip_id)
    return ApiResponse(data=[CollaboratorResponse.model_validate(r) for r in rows])
