"""커뮤니티 데이터 접근 계층.

CLAUDE.md 4계층 규칙에 따라 community 라우트의 SQLAlchemy 쿼리를 이 계층으로 이관.
라우트는 HTTP 검증/권한/응답만 담당하고, DB 접근은 전부 이 repository를 통한다.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import (
    POST_TYPE_LIVE,
    CommunityComment,
    CommunityPost,
    CommunityPostLike,
    CommunityReport,
)
from app.models.user import User


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CommunityRepository:
    # ── 피드 ──────────────────────────────────────────────────────────────────

    async def list_feed(
        self,
        db: AsyncSession,
        *,
        city: str | None,
        category: str | None,
        post_type: str | None,
        limit: int,
        cursor: int | None,
    ) -> list[CommunityPost]:
        now = _utcnow_naive()
        stmt = (
            select(CommunityPost)
            .where(CommunityPost.is_hidden.is_(False))
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
        return list((await db.execute(stmt)).scalars().all())

    async def list_live_feed(
        self, db: AsyncSession, *, city: str | None, limit: int
    ) -> list[CommunityPost]:
        now = _utcnow_naive()
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
        return list((await db.execute(stmt)).scalars().all())

    async def list_trending(
        self,
        db: AsyncSession,
        *,
        period: Literal["1d", "7d", "30d"],
        limit: int,
    ) -> list[tuple[CommunityPost, str, str | None]]:
        now = _utcnow_naive()
        days = {"1d": 1, "7d": 7, "30d": 30}[period]
        since = now - timedelta(days=days)
        score_expr = (
            CommunityPost.like_count + CommunityPost.comment_count * 0.3
        ).label("score")
        stmt = (
            select(CommunityPost, User.nickname, User.profile_image_url)
            .join(User, User.id == CommunityPost.user_id)
            .where(CommunityPost.is_hidden.is_(False))
            .where(CommunityPost.post_type == "regular")
            .where(CommunityPost.created_at >= since)
            .where((CommunityPost.expires_at.is_(None)) | (CommunityPost.expires_at > now))
            .order_by(score_expr.desc(), desc(CommunityPost.created_at))
            .limit(limit)
        )
        return [(post, nickname, img) for post, nickname, img in (await db.execute(stmt)).all()]

    # ── 게시글 ────────────────────────────────────────────────────────────────

    async def get_post(self, db: AsyncSession, post_id: int) -> CommunityPost | None:
        stmt = select(CommunityPost).where(CommunityPost.id == post_id)
        return (await db.execute(stmt)).scalars().first()

    async def add_post(self, db: AsyncSession, post: CommunityPost) -> CommunityPost:
        db.add(post)
        await db.flush()
        await db.refresh(post)
        return post

    async def delete_post(self, db: AsyncSession, post: CommunityPost) -> None:
        await db.delete(post)

    # ── 댓글 ──────────────────────────────────────────────────────────────────

    async def list_comments(self, db: AsyncSession, post_id: int) -> list[CommunityComment]:
        stmt = (
            select(CommunityComment)
            .where(CommunityComment.post_id == post_id)
            .where(CommunityComment.is_hidden.is_(False))
            .order_by(CommunityComment.created_at.asc())
        )
        return list((await db.execute(stmt)).scalars().all())

    async def add_comment(
        self, db: AsyncSession, post: CommunityPost, comment: CommunityComment
    ) -> CommunityComment:
        db.add(comment)
        post.comment_count = (post.comment_count or 0) + 1
        await db.flush()
        await db.refresh(comment)
        return comment

    # ── 좋아요 ────────────────────────────────────────────────────────────────

    async def get_like(
        self, db: AsyncSession, post_id: int, user_id: int
    ) -> CommunityPostLike | None:
        stmt = (
            select(CommunityPostLike)
            .where(CommunityPostLike.post_id == post_id)
            .where(CommunityPostLike.user_id == user_id)
        )
        return (await db.execute(stmt)).scalars().first()

    async def toggle_like(
        self, db: AsyncSession, post: CommunityPost, user_id: int
    ) -> tuple[bool, int]:
        """좋아요 토글. (liked, like_count) 반환."""
        existing = await self.get_like(db, post.id, user_id)
        if existing:
            await db.delete(existing)
            post.like_count = max(0, (post.like_count or 0) - 1)
            liked = False
        else:
            db.add(CommunityPostLike(post_id=post.id, user_id=user_id))
            post.like_count = (post.like_count or 0) + 1
            liked = True
        await db.flush()
        return liked, post.like_count

    # ── 신고 ──────────────────────────────────────────────────────────────────

    async def add_report(self, db: AsyncSession, report: CommunityReport) -> int:
        """신고 추가 후 해당 게시글의 누적 신고 수 반환."""
        db.add(report)
        await db.flush()
        count = (
            await db.execute(
                select(func.count(CommunityReport.id)).where(
                    CommunityReport.post_id == report.post_id
                )
            )
        ).scalar() or 0
        return count

    async def hide_post(self, db: AsyncSession, post: CommunityPost) -> None:
        post.is_hidden = True
        await db.flush()
