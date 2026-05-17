"""커뮤니티 콘텐츠 자동 모더레이션 (Gemini).

글 작성 직후 BackgroundTask로 호출. 결과:
- safe: 통과
- review: 운영자 검토 대기 (피드 노출 유지하되 flag 표시)
- hide: 즉시 자동 숨김

오류 시 항상 safe로 폴백 — 모더레이션 장애로 글이 사라지지 않도록.
"""
import json
import logging
from typing import Literal

from pydantic import BaseModel

from .gemini_client import call_gemini, get_client, parse_json_response
from .prompt_builder import sanitize_user_input

logger = logging.getLogger(__name__)

ModerationVerdict = Literal["safe", "review", "hide"]


class ModerationResult(BaseModel):
    verdict: ModerationVerdict
    categories: list[str]  # 감지된 위반 카테고리 (hate/spam/sexual/violence/personal_info/etc)
    confidence: float       # 0.0 ~ 1.0
    reason: str | None = None


_TEMPLATE = """다음은 여행 커뮤니티에 작성된 글이야. 한국어/일본어 혼용 가능.
플랫폼 정책 위반 가능성을 평가해줘.

[제목]
{title}

[본문]
{body}

[정책 위반 카테고리]
- hate: 혐오·차별·욕설
- spam: 광고·홍보·반복 도배·외부 링크 유도
- sexual: 음란·성적 콘텐츠
- violence: 폭력·자해·위협
- personal_info: 타인 개인정보 노출
- scam: 사기·금융 유도

[판정 기준]
- "safe": 명백히 정책 위반 없음
- "review": 애매하거나 경계선 — 사람 검토 필요
- "hide": 명백히 위반 — 즉시 숨김

[출력 — 다음 JSON 형식만, 다른 설명 금지]
{{
  "verdict": "safe" | "review" | "hide",
  "categories": ["<해당 카테고리 0개 이상>"],
  "confidence": <0.0 ~ 1.0>,
  "reason": "<한 문장 설명 또는 null>"
}}
"""


async def moderate_text(title: str, body: str) -> ModerationResult:
    """제목 + 본문을 Gemini로 1차 분류. 실패 시 safe 폴백."""
    safe_title = sanitize_user_input(title, max_len=200)
    safe_body = sanitize_user_input(body, max_len=2000)  # 본문 너무 길면 앞부분만

    prompt = _TEMPLATE.format(title=safe_title, body=safe_body)
    try:
        client = get_client()
        raw = await call_gemini(client, prompt)
        data = parse_json_response(raw)
        return ModerationResult.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Moderation parse failed (defaulting safe): %s", e)
        return ModerationResult(verdict="safe", categories=[], confidence=0.0, reason="parse_failed")
    except Exception as e:
        logger.warning("Moderation call failed (defaulting safe): %s", e)
        return ModerationResult(verdict="safe", categories=[], confidence=0.0, reason="call_failed")
