"""커뮤니티 라우트 — 도시별 피드, 글/댓글 CRUD, 좋아요·신고.

신고 누적 시 자동 숨김(3건) — 1차 모더레이션. Gemini 자동 분류는 후속.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.community import (
    LIVE_TTL_HOURS,
    POST_TYPE_LIVE,
    CommunityComment,
    CommunityPost,
    CommunityReport,
)
from app.repositories.community_repository import CommunityRepository
from app.schemas.common import ApiResponse
from app.services.ai.moderation import moderate_text

import logging

_logger = logging.getLogger(__name__)

_repo = CommunityRepository()


# ── 비동기 모더레이션 작업 ─────────────────────────────────────────────────────


async def _moderate_post_bg(post_id: int) -> None:
    """글 작성 후 BackgroundTask. 자체 세션으로 실행."""
    async with AsyncSessionLocal() as db:
        post = (
            (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
            .scalars()
            .first()
        )
        if post is None:
            return
        result = await moderate_text(post.title, post.body)
        post.moderation_status = result.verdict
        post.moderation_categories = result.categories or None
        if result.verdict == "hide":
            post.is_hidden = True
        await db.commit()
        _logger.info("Post %s moderated: %s (cat=%s)", post_id, result.verdict, result.categories)


async def _moderate_comment_bg(comment_id: int) -> None:
    async with AsyncSessionLocal() as db:
        comment = (
            (await db.execute(select(CommunityComment).where(CommunityComment.id == comment_id)))
            .scalars()
            .first()
        )
        if comment is None:
            return
        # 댓글은 제목 없으므로 body만
        result = await moderate_text("(댓글)", comment.body)
        comment.moderation_status = result.verdict
        comment.moderation_categories = result.categories or None
        if result.verdict == "hide":
            comment.is_hidden = True
        await db.commit()
        _logger.info("Comment %s moderated: %s", comment_id, result.verdict)


router = APIRouter(prefix="/community", tags=["community"])


# ── 스키마 ────────────────────────────────────────────────────────────────────


class PostCreate(BaseModel):
    post_type: Literal["regular", "live"] = "regular"
    category: Literal["qna", "review", "photospot"] = "qna"
    city: str | None = Field(default=None, max_length=50)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    images: list[str] | None = None


class PostResponse(BaseModel):
    id: int
    user_id: int
    post_type: str
    category: str
    city: str | None
    title: str
    body: str
    images: list[str] | None
    like_count: int
    comment_count: int
    expires_at: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    body: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    reason: Literal["spam", "hate", "sexual", "other"]
    detail: str | None = Field(default=None, max_length=1000)


class TrendingPostResponse(PostResponse):
    """인기 여행기용 — 작성자 정보 포함."""

    nickname: str
    profile_image_url: str | None


# ── 피드 ─────────────────────────────────────────────────────────────────────


@router.get("/feed", response_model=ApiResponse[list[PostResponse]])
async def feed(
    current_user: CurrentUser,
    db: DbSession,
    city: str | None = Query(default=None, max_length=50),
    category: Literal["qna", "review", "photospot"] | None = Query(default=None),
    post_type: Literal["regular", "live"] | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: int | None = Query(default=None, description="마지막으로 받은 post_id (exclusive)"),
) -> ApiResponse[list[PostResponse]]:
    rows = await _repo.list_feed(
        db,
        city=city,
        category=category,
        post_type=post_type,
        limit=limit,
        cursor=cursor,
    )
    return ApiResponse(data=[PostResponse.model_validate(r) for r in rows])


@router.get("/feed/live", response_model=ApiResponse[list[PostResponse]])
async def live_feed(
    current_user: CurrentUser,
    db: DbSession,
    city: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=20, ge=1, le=50),
) -> ApiResponse[list[PostResponse]]:
    """실시간 마이크로피드 — live 게시글만, 최신순, 만료 제외.

    5분마다 자동 새로고침 권장 (모바일에서 setInterval 사용).
    """
    rows = await _repo.list_live_feed(db, city=city, limit=limit)
    return ApiResponse(data=[PostResponse.model_validate(r) for r in rows])


@router.get("/trending", response_model=ApiResponse[list[TrendingPostResponse]])
async def trending_posts(
    current_user: CurrentUser,
    db: DbSession,
    period: Literal["1d", "7d", "30d"] = Query(default="7d"),
    limit: int = Query(default=10, ge=1, le=30),
) -> ApiResponse[list[TrendingPostResponse]]:
    """인기 여행기 — like_count DESC + comment_count*0.3 복합 점수 정렬.

    기간(period)에 따라 최근 N일 내 게시글만 대상.
    """
    rows = await _repo.list_trending(db, period=period, limit=limit)

    result: list[TrendingPostResponse] = []
    for post, nickname, profile_image_url in rows:
        data = PostResponse.model_validate(post).model_dump()
        data["nickname"] = nickname
        data["profile_image_url"] = profile_image_url
        result.append(TrendingPostResponse(**data))

    return ApiResponse(data=result)


# ── 게시글 ───────────────────────────────────────────────────────────────────


@router.post("/posts", response_model=ApiResponse[PostResponse], status_code=201)
@limiter.limit("10/hour")
async def create_post(
    request: Request,
    body: PostCreate,
    background: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[PostResponse]:
    # live 게시글: expires_at = 작성 시각 + 6시간 TTL
    expires_at = None
    if body.post_type == POST_TYPE_LIVE:
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
            hours=LIVE_TTL_HOURS
        )

    post = CommunityPost(
        user_id=current_user.id,
        post_type=body.post_type,
        category=body.category,
        city=body.city,
        title=body.title,
        body=body.body,
        images=body.images,
        expires_at=expires_at,
    )
    post = await _repo.add_post(db, post)
    # 응답 차단하지 않고 Gemini 모더레이션 비동기 실행
    background.add_task(_moderate_post_bg, post.id)
    return ApiResponse(data=PostResponse.model_validate(post))


@router.get("/posts/{post_id}", response_model=ApiResponse[PostResponse])
async def get_post(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[PostResponse]:
    post = await _repo.get_post(db, post_id)
    if post is None or post.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    return ApiResponse(data=PostResponse.model_validate(post))


@router.delete("/posts/{post_id}", response_model=ApiResponse[None])
async def delete_post(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    post = await _repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    await _repo.delete_post(db, post)
    return ApiResponse(data=None, message="삭제되었습니다.")


# ── 댓글 ─────────────────────────────────────────────────────────────────────


@router.get("/posts/{post_id}/comments", response_model=ApiResponse[list[CommentResponse]])
async def list_comments(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[CommentResponse]]:
    rows = await _repo.list_comments(db, post_id)
    return ApiResponse(data=[CommentResponse.model_validate(r) for r in rows])


@router.post(
    "/posts/{post_id}/comments",
    response_model=ApiResponse[CommentResponse],
    status_code=201,
)
@limiter.limit("30/hour")
async def create_comment(
    request: Request,
    post_id: int,
    body: CommentCreate,
    background: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[CommentResponse]:
    post = await _repo.get_post(db, post_id)
    if post is None or post.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    comment = CommunityComment(post_id=post_id, user_id=current_user.id, body=body.body)
    comment = await _repo.add_comment(db, post, comment)
    background.add_task(_moderate_comment_bg, comment.id)
    return ApiResponse(data=CommentResponse.model_validate(comment))


# ── 좋아요 ───────────────────────────────────────────────────────────────────


@router.post("/posts/{post_id}/like", response_model=ApiResponse[dict])
async def toggle_like(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[dict]:
    post = await _repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    liked, like_count = await _repo.toggle_like(db, post, current_user.id)
    return ApiResponse(data={"liked": liked, "like_count": like_count})


# ── 신고 ─────────────────────────────────────────────────────────────────────

_AUTO_HIDE_THRESHOLD = 3


@router.post("/posts/{post_id}/report", response_model=ApiResponse[None], status_code=201)
@limiter.limit("20/hour")
async def report_post(
    request: Request,
    post_id: int,
    body: ReportCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    post = await _repo.get_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )

    report = CommunityReport(
        reporter_id=current_user.id,
        post_id=post_id,
        reason=body.reason,
        detail=body.detail,
    )
    count = await _repo.add_report(db, report)

    # 누적 신고 ≥ 3건이면 자동 숨김 (운영자 검토 대기)
    if count >= _AUTO_HIDE_THRESHOLD:
        await _repo.hide_post(db, post)

    return ApiResponse(data=None, message="신고가 접수되었습니다.")
