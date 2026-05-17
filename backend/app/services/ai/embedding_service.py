"""장소 텍스트 → 768차원 벡터 임베딩 서비스.

Gemini text-embedding-004 모델 사용.
- 차원: 768 (Location.embedding 컬럼과 일치)
- 용도: 코사인 유사도로 의미적으로 가까운 장소 검색
"""

import asyncio
import logging
from functools import lru_cache

from google import genai
from google.genai import types

from app.config import get_settings

logger = logging.getLogger(__name__)

# text-embedding-004는 2025년 v1beta에서 NOT_FOUND. gemini-embedding-001로 마이그레이션.
# 디폴트 출력 차원은 3072이므로 명시적으로 768로 축소 (DB 컬럼과 호환).
_EMBEDDING_MODEL = "gemini-embedding-001"
_EMBEDDING_DIM = 768


@lru_cache(maxsize=1)
def _get_embedding_client() -> genai.Client:
    return genai.Client(api_key=get_settings().gemini_api_key)


def _build_place_text(name: str, category: str, address: str, notes: str | None) -> str:
    """임베딩 입력 텍스트 조합. 장소 특성을 최대한 담는다."""
    parts = [name, category, address]
    if notes:
        parts.append(notes)
    return " | ".join(p.strip() for p in parts if p.strip())


async def embed_place(
    name: str,
    category: str,
    address: str,
    notes: str | None = None,
) -> list[float] | None:
    """장소 정보를 임베딩 벡터로 변환. API 실패 시 None 반환 (graceful)."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    text = _build_place_text(name, category, address, notes)
    try:
        client = _get_embedding_client()
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.embed_content(
                model=_EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=_EMBEDDING_DIM,
                ),
            ),
        )
        return response.embeddings[0].values
    except Exception as exc:
        logger.warning("임베딩 생성 실패 (장소: %s): %s", name, exc)
        return None


async def embed_query(query: str) -> list[float] | None:
    """검색 쿼리를 임베딩 벡터로 변환."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    try:
        client = _get_embedding_client()
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.models.embed_content(
                model=_EMBEDDING_MODEL,
                contents=query,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY",
                    output_dimensionality=_EMBEDDING_DIM,
                ),
            ),
        )
        return response.embeddings[0].values
    except Exception as exc:
        logger.warning("쿼리 임베딩 실패: %s", exc)
        return None
