"""게이미피케이션 서비스 — XP 계산, 레벨, 배지 수여.

XP 획득 기준:
  여행 생성       50 XP
  장소 추가       10 XP (per location)
  커뮤니티 글     30 XP
  댓글 작성       10 XP
  좋아요 받기      5 XP (per like received)
  장소 저장        5 XP (per saved place)

레벨 구간:
  Lv.1 새내기 여행자    0 ~ 99 XP
  Lv.2 탐험가         100 ~ 299 XP
  Lv.3 여행 마니아    300 ~ 699 XP
  Lv.4 여행 고수      700 ~ 1499 XP
  Lv.5 여행 마스터    1500+ XP

배지 카탈로그 (10종):
  첫 여행       first_trip      첫 번째 여행 생성
  탐험가         explorer        여행 5개 이상
  세계 여행자   globe_trotter   여행 10개 이상
  소셜버터플라이 social          커뮤니티 첫 글
  인플루언서     influencer      좋아요 누적 20개 이상
  사진작가       photographer    이미지 포함 글 5개 이상
  장소 수집가   collector       저장 장소 10개 이상
  계획왕         planner         단일 여행에 장소 10개 이상 추가
  단골손님       regular         앱 사용 30일 이상
  나이트아울     night_owl       자정 이후 여행 생성 (재미 요소)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.badge import UserBadge
from app.models.community import CommunityComment, CommunityPost
from app.models.saved_place import SavedPlace
from app.models.trip import Trip
from app.models.location import Location


# ── 레벨 정의 ──────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LevelInfo:
    level: int
    title_ko: str
    title_en: str
    min_xp: int
    max_xp: int | None  # None = 최고 레벨
    emoji: str


LEVELS: list[LevelInfo] = [
    LevelInfo(1, "새내기 여행자", "Newbie", 0, 99, "🌱"),
    LevelInfo(2, "탐험가", "Explorer", 100, 299, "🧭"),
    LevelInfo(3, "여행 마니아", "Travel Buff", 300, 699, "✈️"),
    LevelInfo(4, "여행 고수", "Veteran", 700, 1499, "🌍"),
    LevelInfo(5, "여행 마스터", "Master", 1500, None, "👑"),
]


# ── 배지 카탈로그 ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class BadgeDefinition:
    badge_id: str
    name_ko: str
    name_en: str
    description_ko: str
    emoji: str


BADGE_CATALOG: dict[str, BadgeDefinition] = {
    b.badge_id: b
    for b in [
        BadgeDefinition("first_trip", "첫 여행", "First Trip", "첫 번째 여행을 만들었어요", "🗺️"),
        BadgeDefinition("explorer", "탐험가", "Explorer", "여행을 5개 이상 만들었어요", "🧭"),
        BadgeDefinition(
            "globe_trotter", "세계 여행자", "Globe Trotter", "여행을 10개 이상 만들었어요", "🌍"
        ),
        BadgeDefinition(
            "social", "소셜버터플라이", "Social Butterfly", "커뮤니티에 첫 글을 올렸어요", "🦋"
        ),
        BadgeDefinition(
            "influencer", "인플루언서", "Influencer", "좋아요를 20개 이상 받았어요", "⭐"
        ),
        BadgeDefinition(
            "photographer", "사진작가", "Photographer", "이미지가 있는 글을 5개 이상 올렸어요", "📸"
        ),
        BadgeDefinition(
            "collector", "장소 수집가", "Collector", "장소를 10곳 이상 저장했어요", "❤️"
        ),
        BadgeDefinition(
            "planner", "계획왕", "Planner", "한 여행에 장소를 10곳 이상 추가했어요", "📋"
        ),
        BadgeDefinition("regular", "단골손님", "Regular", "앱을 30일 이상 사용했어요", "🏅"),
        BadgeDefinition(
            "night_owl", "나이트아울", "Night Owl", "자정 이후에 여행을 만들었어요", "🦉"
        ),
    ]
}


# ── XP 계산 ─────────────────────────────────────────────────────────────────────


async def calculate_xp(db: AsyncSession, user_id: int) -> int:
    """사용자의 현재 총 XP를 DB에서 동적으로 계산."""

    # 여행 수 (50 XP each)
    trip_count_result = await db.execute(select(func.count()).where(Trip.user_id == user_id))
    trip_count = trip_count_result.scalar() or 0

    # 장소 수 (10 XP each) — 본인 여행의 장소만
    location_count_result = await db.execute(
        select(func.count(Location.id))
        .join(Trip, Location.trip_id == Trip.id)
        .where(Trip.user_id == user_id)
    )
    location_count = location_count_result.scalar() or 0

    # 커뮤니티 글 수 (30 XP each)
    post_count_result = await db.execute(
        select(func.count()).where(CommunityPost.user_id == user_id)
    )
    post_count = post_count_result.scalar() or 0

    # 댓글 수 (10 XP each)
    comment_count_result = await db.execute(
        select(func.count()).where(CommunityComment.user_id == user_id)
    )
    comment_count = comment_count_result.scalar() or 0

    # 받은 좋아요 합계 (5 XP each)
    likes_result = await db.execute(
        select(func.sum(CommunityPost.like_count)).where(CommunityPost.user_id == user_id)
    )
    likes_received = likes_result.scalar() or 0

    # 저장 장소 수 (5 XP each)
    saved_result = await db.execute(select(func.count()).where(SavedPlace.user_id == user_id))
    saved_count = saved_result.scalar() or 0

    xp = (
        trip_count * 50
        + location_count * 10
        + post_count * 30
        + comment_count * 10
        + int(likes_received) * 5
        + saved_count * 5
    )
    return xp


def get_level_info(xp: int) -> LevelInfo:
    """XP로 현재 레벨 정보 반환."""
    current = LEVELS[0]
    for level in LEVELS:
        if xp >= level.min_xp:
            current = level
    return current


def get_xp_progress(xp: int) -> dict:
    """현재 레벨 내 진행률 계산."""
    level = get_level_info(xp)
    if level.max_xp is None:
        return {"current": xp - level.min_xp, "required": 0, "percentage": 100}
    current_in_level = xp - level.min_xp
    required = level.max_xp - level.min_xp + 1
    percentage = min(100, int(current_in_level / required * 100))
    return {
        "current": current_in_level,
        "required": required,
        "percentage": percentage,
    }


# ── 배지 수여 ─────────────────────────────────────────────────────────────────


async def _already_has_badge(db: AsyncSession, user_id: int, badge_id: str) -> bool:
    result = await db.execute(
        select(UserBadge).where(
            UserBadge.user_id == user_id,
            UserBadge.badge_id == badge_id,
        )
    )
    return result.scalars().first() is not None


async def _award(db: AsyncSession, user_id: int, badge_id: str) -> bool:
    """배지 수여. 이미 있으면 False, 새로 수여하면 True."""
    if await _already_has_badge(db, user_id, badge_id):
        return False
    db.add(UserBadge(user_id=user_id, badge_id=badge_id))
    await db.flush()
    return True


async def evaluate_and_award_badges(
    db: AsyncSession,
    user_id: int,
    user_created_at: datetime,
) -> list[str]:
    """모든 배지 조건을 점검하고 새로 획득한 배지 ID 목록을 반환."""
    newly_earned: list[str] = []

    # ── 여행 관련 ──
    trip_count_result = await db.execute(select(func.count()).where(Trip.user_id == user_id))
    trip_count = trip_count_result.scalar() or 0

    if trip_count >= 1 and await _award(db, user_id, "first_trip"):
        newly_earned.append("first_trip")
    if trip_count >= 5 and await _award(db, user_id, "explorer"):
        newly_earned.append("explorer")
    if trip_count >= 10 and await _award(db, user_id, "globe_trotter"):
        newly_earned.append("globe_trotter")

    # 자정 이후 여행 생성 여부
    night_trip = await db.execute(
        select(Trip).where(
            Trip.user_id == user_id,
            func.extract("hour", Trip.created_at) >= 0,
            func.extract("hour", Trip.created_at) < 5,
        )
    )
    if night_trip.scalars().first() and await _award(db, user_id, "night_owl"):
        newly_earned.append("night_owl")

    # ── 커뮤니티 관련 ──
    post_count_result = await db.execute(
        select(func.count()).where(CommunityPost.user_id == user_id)
    )
    post_count = post_count_result.scalar() or 0

    if post_count >= 1 and await _award(db, user_id, "social"):
        newly_earned.append("social")

    # 이미지 포함 글 5개 이상 (images IS NOT NULL — 저장 시 빈 배열은 None으로 처리됨)
    photo_posts_result = await db.execute(
        select(func.count()).where(
            CommunityPost.user_id == user_id,
            CommunityPost.images.isnot(None),
        )
    )
    photo_posts = photo_posts_result.scalar() or 0
    if photo_posts >= 5 and await _award(db, user_id, "photographer"):
        newly_earned.append("photographer")

    # 받은 좋아요 합계
    likes_result = await db.execute(
        select(func.sum(CommunityPost.like_count)).where(CommunityPost.user_id == user_id)
    )
    likes_received = int(likes_result.scalar() or 0)
    if likes_received >= 20 and await _award(db, user_id, "influencer"):
        newly_earned.append("influencer")

    # ── 저장 관련 ──
    saved_result = await db.execute(select(func.count()).where(SavedPlace.user_id == user_id))
    saved_count = saved_result.scalar() or 0
    if saved_count >= 10 and await _award(db, user_id, "collector"):
        newly_earned.append("collector")

    # ── 장소 추가 (계획왕) ──
    # 단일 여행에 장소 10개 이상
    planner_result = await db.execute(select(Trip.id).where(Trip.user_id == user_id))
    trip_ids = [row[0] for row in planner_result.fetchall()]
    for tid in trip_ids:
        loc_count_result = await db.execute(select(func.count()).where(Location.trip_id == tid))
        if (loc_count_result.scalar() or 0) >= 10:
            if await _award(db, user_id, "planner"):
                newly_earned.append("planner")
            break

    # ── 가입 기간 (단골손님) ──
    days_since = (datetime.now(timezone.utc).replace(tzinfo=None) - user_created_at).days
    if days_since >= 30 and await _award(db, user_id, "regular"):
        newly_earned.append("regular")

    return newly_earned


# ── 전체 조회 ─────────────────────────────────────────────────────────────────


async def get_user_gamification(
    db: AsyncSession,
    user_id: int,
    user_created_at: datetime,
) -> dict:
    """프로필 API용 게이미피케이션 전체 데이터."""
    xp = await calculate_xp(db, user_id)
    level = get_level_info(xp)
    progress = get_xp_progress(xp)

    # 획득한 배지 목록
    badges_result = await db.execute(
        select(UserBadge).where(UserBadge.user_id == user_id).order_by(UserBadge.earned_at.asc())
    )
    earned_badges = badges_result.scalars().all()

    badges = []
    for ub in earned_badges:
        defn = BADGE_CATALOG.get(ub.badge_id)
        if defn:
            badges.append(
                {
                    "badge_id": defn.badge_id,
                    "name_ko": defn.name_ko,
                    "name_en": defn.name_en,
                    "description_ko": defn.description_ko,
                    "emoji": defn.emoji,
                    "earned_at": ub.earned_at.isoformat(),
                }
            )

    # 미획득 배지 (잠금 상태로 표시용)
    earned_ids = {b["badge_id"] for b in badges}
    locked_badges = [
        {
            "badge_id": defn.badge_id,
            "name_ko": defn.name_ko,
            "name_en": defn.name_en,
            "description_ko": defn.description_ko,
            "emoji": defn.emoji,
            "earned_at": None,
        }
        for defn in BADGE_CATALOG.values()
        if defn.badge_id not in earned_ids
    ]

    return {
        "xp": xp,
        "level": level.level,
        "level_title_ko": level.title_ko,
        "level_title_en": level.title_en,
        "level_emoji": level.emoji,
        "xp_current": progress["current"],
        "xp_required": progress["required"],
        "xp_percentage": progress["percentage"],
        "badges": badges,
        "locked_badges": locked_badges,
    }
