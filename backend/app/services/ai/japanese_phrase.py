"""한국어 → 일본어 회화 변환 (Gemini).

상황·격식 수준에 따라 자연스러운 일본어 + 히라가나/로마자 발음을 함께 반환.
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


class JapanesePhraseResult(BaseModel):
    korean: str = Field(description="입력 원문 (정제 후)")
    japanese: str = Field(description="자연스러운 일본어 표현")
    hiragana: str = Field(description="히라가나/가타카나 표기")
    romaji: str = Field(description="로마자 발음")
    note: str | None = Field(default=None, description="문화/주의 사항")


_TEMPLATE = """다음 한국어 표현을 일본 여행자가 현지에서 사용할 수 있는 자연스러운 일본어로 변환해줘.

[입력 한국어]
{text}

[상황] {context}
[격식 수준] {formality}  (polite=정중한 です/ます체, casual=친근한 반말체)

[출력 형식 — 반드시 다음 JSON 형식만 출력. 다른 설명 금지]
{{
  "korean": "<입력 원문 그대로>",
  "japanese": "<자연스러운 일본어 한 문장>",
  "hiragana": "<일본어 전체를 히라가나/가타카나로 표기>",
  "romaji": "<로마자 발음, 헵번식>",
  "note": "<선택: 문화 차이나 주의할 점, 없으면 null>"
}}
"""


async def translate_phrase(
    text: str,
    context: str = "casual",
    formality: str = "polite",
) -> JapanesePhraseResult:
    if context not in VALID_CONTEXTS:
        context = "casual"
    if formality not in VALID_FORMALITY:
        formality = "polite"

    safe_text = sanitize_user_input(text, max_len=200)
    if not safe_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="번역할 한국어 표현을 입력해주세요.",
        )

    prompt = _TEMPLATE.format(text=safe_text, context=context, formality=formality)
    client = get_client()
    raw = await call_gemini(client, prompt)
    try:
        data = parse_json_response(raw)
        return JapanesePhraseResult.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Japanese phrase parse failed: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="번역에 실패했어요. 다시 시도해주세요.",
        )
