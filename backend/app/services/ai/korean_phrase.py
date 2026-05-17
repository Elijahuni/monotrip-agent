"""일본어 → 한국어 회화 변환 (Gemini).

일본인 관광객이 한국에서 사용할 자연스러운 한국어 + 한글 + 로마자(RR) 표기.
"""
import json
import logging

from fastapi import HTTPException, status
from pydantic import BaseModel, Field

from .gemini_client import call_gemini, get_client, parse_json_response
from .prompt_builder import sanitize_user_input

logger = logging.getLogger(__name__)

VALID_CONTEXTS: tuple[str, ...] = (
    "restaurant", "shopping", "transport", "hotel", "emergency", "casual",
)
VALID_FORMALITY: tuple[str, ...] = ("polite", "casual")


class KoreanPhraseResult(BaseModel):
    japanese: str = Field(description="입력 일본어 원문")
    korean: str = Field(description="자연스러운 한국어 표현")
    romanized: str = Field(description="국립국어원 로마자 표기 (Revised Romanization)")
    note: str | None = Field(default=None, description="문화/주의 사항")


_TEMPLATE = """다음 일본어 표현을 한국 여행자가 사용할 자연스러운 한국어로 변환해줘.

[입력 일본어]
{text}

[상황] {context}
[격식 수준] {formality}  (polite=정중한 ~요/입니다체, casual=반말체)

[출력 형식 — 반드시 다음 JSON 형식만 출력. 다른 설명 금지]
{{
  "japanese": "<입력 원문 그대로>",
  "korean": "<자연스러운 한국어 한 문장>",
  "romanized": "<한국어를 국립국어원 로마자 표기법(Revised Romanization)으로>",
  "note": "<선택: 일본과 다른 점·주의 사항, 없으면 null>"
}}
"""


async def translate_to_korean(
    text: str,
    context: str = "casual",
    formality: str = "polite",
) -> KoreanPhraseResult:
    if context not in VALID_CONTEXTS:
        context = "casual"
    if formality not in VALID_FORMALITY:
        formality = "polite"

    safe_text = sanitize_user_input(text, max_len=200)
    if not safe_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="번역할 일본어 표현을 입력해주세요.",
        )

    prompt = _TEMPLATE.format(text=safe_text, context=context, formality=formality)
    client = get_client()
    raw = await call_gemini(client, prompt)
    try:
        data = parse_json_response(raw)
        return KoreanPhraseResult.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Korean phrase parse failed: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="번역에 실패했어요. 다시 시도해주세요.",
        )
