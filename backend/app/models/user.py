from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole:
    """사용자 역할 상수. Enum 대신 str 상수 — Alembic/JSON 직렬화 호환."""

    USER = "user"
    MODERATOR = "moderator"  # 콘텐츠 검토 전용 (향후 확장)
    ADMIN = "admin"


_EMBEDDING_DIM = 768


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # OAuth 가입자는 password가 없으므로 nullable. local 가입은 필수.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # OAuth 연동 — "local" | "kakao" | "google" | ...
    auth_provider: Mapped[str] = mapped_column(String(20), default="local", nullable=False)
    # 외부 provider의 user id (예: kakao_id). provider+id로 unique.
    provider_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Expo 푸시 토큰 — 모바일 앱이 권한을 허가했을 때 등록.
    # None = 알림 미수신 대상 (토큰 없음 또는 권한 거부).
    expo_push_token: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    # 사용자 선호 임베딩 — 장소 추가/저장 행동을 누적해 갱신.
    # 큐레이션 추천 시 장소 임베딩과 코사인 유사도로 개인화에 활용.
    preference_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(_EMBEDDING_DIM), nullable=True
    )
    # 역할 — "user" | "moderator" | "admin"
    role: Mapped[str] = mapped_column(String(20), default=UserRole.USER, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )
