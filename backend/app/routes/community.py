"""커뮤니티 라우트 — 도시별 피드, 글/댓글 CRUD, 좋아요·신고.

신고 누적 시 자동 숨김(3건) — 1차 모더레이션. Gemini 자동 분류는 후속.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select

from app.database import AsyncSessionLocal
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.models.community import (
    LIVE_TTL_HOURS,
    POST_TYPE_LIVE,
    CommunityComment,
    CommunityPost,
    CommunityPostLike,
    CommunityReport,
)
from app.schemas.common import ApiResponse
from app.services.ai.moderation import moderate_text

import logging

_logger = logging.getLogger(__name__)


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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    stmt = (
        select(CommunityPost)
        .where(CommunityPost.is_hidden.is_(False))
        # 만료된 live 게시글 제외
        .where((CommunityPost.expires_at.is_(None)) | (CommunityPost.expires_at > now))
        .order_by(desc(CommunityPost.id))
        .limit(limit)
    )
    if city:
        stmt = stmt.where(CommunityPost.city == city)
    if category:
        stmt = stmt.where(CommunityPost.category == category)
    if post_type:
        stmt = stmt.where(CommunityPost.post_type == post_type)
    if cursor:
        stmt = stmt.where(CommunityPost.id < cursor)
    rows = (await db.execute(stmt)).scalars().all()
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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    stmt = (
        select(CommunityPost)
        .where(CommunityPost.post_type == POST_TYPE_LIVE)
        .where(CommunityPost.is_hidden.is_(False))
        .where(CommunityPost.expires_at > now)
        .order_by(desc(CommunityPost.created_at))
        .limit(limit)
    )
    if city:
        stmt = stmt.where(CommunityPost.city == city)
    rows = (await db.execute(stmt)).scalars().all()
    return ApiResponse(data=[PostResponse.model_validate(r) for r in rows])


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
    db.add(post)
    await db.flush()
    await db.refresh(post)
    # 응답 차단하지 않고 Gemini 모더레이션 비동기 실행
    background.add_task(_moderate_post_bg, post.id)
    return ApiResponse(data=PostResponse.model_validate(post))


@router.get("/posts/{post_id}", response_model=ApiResponse[PostResponse])
async def get_post(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[PostResponse]:
    post = (
        (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
        .scalars()
        .first()
    )
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
    post = (
        (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
        .scalars()
        .first()
    )
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    await db.delete(post)
    return ApiResponse(data=None, message="삭제되었습니다.")


# ── 댓글 ─────────────────────────────────────────────────────────────────────


@router.get("/posts/{post_id}/comments", response_model=ApiResponse[list[CommentResponse]])
async def list_comments(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[list[CommentResponse]]:
    rows = (
        (
            await db.execute(
                select(CommunityComment)
                .where(CommunityComment.post_id == post_id)
                .where(CommunityComment.is_hidden.is_(False))
                .order_by(CommunityComment.created_at.asc())
            )
        )
        .scalars()
        .all()
    )
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
    post = (
        (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
        .scalars()
        .first()
    )
    if post is None or post.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    comment = CommunityComment(post_id=post_id, user_id=current_user.id, body=body.body)
    db.add(comment)
    post.comment_count = (post.comment_count or 0) + 1
    await db.flush()
    await db.refresh(comment)
    background.add_task(_moderate_comment_bg, comment.id)
    return ApiResponse(data=CommentResponse.model_validate(comment))


# ── 좋아요 ───────────────────────────────────────────────────────────────────


@router.post("/posts/{post_id}/like", response_model=ApiResponse[dict])
async def toggle_like(
    post_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[dict]:
    post = (
        (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
        .scalars()
        .first()
    )
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다."
        )
    existing = (
        (
            await db.execute(
                select(CommunityPostLike)
                .where(CommunityPostLike.post_id == post_id)
                .where(CommunityPostLike.user_id == current_user.id)
            )
        )
        .scalars()
        .first()
    )
    if existing:
        await db.delete(existing)
        post.like_count = max(0, (post.like_count or 0) - 1)
        liked = False
    else:
        db.add(CommunityPostLike(post_id=post_id, user_id=current_user.id))
        post.like_count = (post.like_count or 0) + 1
        liked = True
    await db.flush()
    return ApiResponse(data={"liked": liked, "like_count": post.like_count})


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
    post = (
        (await db.execute(select(CommunityPost).where(CommunityPost.id == post_id)))
        .scalars()
        .first()
    )
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
    db.add(report)
    await db.flush()

    # 누적 신고 ≥ 3건이면 자동 숨김 (운영자 검토 대기)
    count = (
        await db.execute(
            select(func.count(CommunityReport.id)).where(CommunityReport.post_id == post_id)
        )
    ).scalar() or 0
    if count >= _AUTO_HIDE_THRESHOLD:
        post.is_hidden = True
        await db.flush()

    return ApiResponse(data=None, message="신고가 접수되었습니다.")
