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


class RoleUpdateBody(BaseModel):
    role: Literal["edit", "view"]


class CollaboratorResponse(BaseModel):
    user_id: int
    role: str
    joined_at: datetime
    nickname: str | None = None  # 목록 조회 시 채워짐 (수락 응답에선 None)
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
    rows = await _service.list_collaborators_with_nicknames(db, trip_id)
    return ApiResponse(
        data=[
            CollaboratorResponse(
                user_id=c.user_id,
                role=c.role,
                joined_at=c.joined_at,
                nickname=nickname,
            )
            for c, nickname in rows
        ]
    )


@router.patch(
    "/trips/{trip_id}/collaborators/{user_id}",
    response_model=ApiResponse[CollaboratorResponse],
)
async def update_collaborator_role(
    trip_id: int,
    user_id: int,
    body: RoleUpdateBody,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[CollaboratorResponse]:
    """협업자 역할(edit/view) 변경 — 여행 소유자만 가능."""
    collab = await _service.update_collaborator_role(
        db,
        trip_id=trip_id,
        owner_id=current_user.id,
        target_user_id=user_id,
        role=body.role,
    )
    return ApiResponse(data=CollaboratorResponse.model_validate(collab))


@router.delete(
    "/trips/{trip_id}/collaborators/{user_id}",
    response_model=ApiResponse[None],
)
async def remove_collaborator(
    trip_id: int,
    user_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    """협업자 제거 — 여행 소유자만 가능."""
    await _service.remove_collaborator(
        db, trip_id=trip_id, owner_id=current_user.id, target_user_id=user_id
    )
    return ApiResponse(data=None, message="협업자가 제거되었습니다.")
