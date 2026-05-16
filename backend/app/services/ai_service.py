import json
import logging
import re

from fastapi import HTTPException, status
from google import genai
from google.genai import types

from app.config import get_settings
from app.schemas.ai import AiLocationPlan, AiRefineRequest, AiTripPlan, DestinationGuide

logger = logging.getLogger(__name__)

# ─── Gemini 모델 우선순위 목록 ────────────────────────────────────────────────
# API 키의 v1beta 모델 목록(GET /v1beta/models)에서 generateContent를 지원하는 것만 사용.
# 신규 계정은 gemini-2.0-flash / gemini-2.0-flash-001 계열이 차단될 수 있음.
# gemini-2.5-flash: 신규 계정 제한 없이 사용 가능한 최신 안정 모델.
# 상위부터 순서대로 시도 → 404 시 다음 모델로 자동 전환.
_CANDIDATE_MODELS: list[str] = [
    "gemini-2.5-flash",      # 최신 안정 (신규 계정 사용 가능 ✅ 실증)
    "gemini-2.5-flash-lite", # 경량 2.5 (신규 계정 사용 가능 ✅ 실증)
    "gemini-2.5-pro",        # Pro — 위 둘 실패 시 최후 수단
]


def _sanitize_user_input(text: str, max_len: int = 200) -> str:
    """프롬프트 인젝션 방어 — HTML 태그와 LLM 역할 전환 키워드 제거."""
    if not text:
        return ""
    # HTML 태그 제거
    cleaned = re.sub(r"<[^>]+>", "", text)
    # 흔한 프롬프트 인젝션 패턴 제거 (ignore instructions, system:, etc.)
    cleaned = re.sub(
        r"\b(ignore|forget|disregard|override|system|assistant|user)\s*[:\-]\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned[:max_len].strip()

_PROMPT_TEMPLATE = """\
다음 조건에 맞는 여행 일정을 JSON 형식으로만 생성해줘. JSON 외의 다른 텍스트는 포함하지 마.

목적지: {destination}
여행 기간: {days}일
여행 스타일: {preferences}

반환할 JSON 스키마:
{{
  "title": "여행 제목 (예: 도쿄 3일 미식 여행)",
  "description": "여행 전반적인 소개 (2~3문장)",
  "locations": [
    {{
      "name": "장소명",
      "address": "전체 주소 (국가 포함)",
      "latitude": 위도(float),
      "longitude": 경도(float),
      "category": "관광지 | 음식점 | 숙소 | 쇼핑 | 액티비티",
      "visit_order": 방문순서(1부터 시작, 전체 일정 기준),
      "notes": "방문 팁 또는 추천 이유"
    }}
  ]
}}

조건:
- 하루에 4~5개 장소 포함 (총 {total_locations}개 내외)
- 실제 존재하는 장소의 정확한 위도/경도 제공
- category는 반드시 "관광지", "음식점", "숙소", "쇼핑", "액티비티" 중 하나
- 숙소는 하루에 1개, 음식점은 하루에 1~2개 포함
- visit_order는 전체 일정에서 방문 순서 (1, 2, 3, ...)
"""


def _get_client() -> genai.Client:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API 키가 설정되지 않았습니다.",
        )
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_json(raw: str) -> dict:
    """마크다운 코드블록(```json ... ```)을 제거하고 JSON 파싱."""
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
    return json.loads(cleaned)


async def _call_gemini(client: genai.Client, prompt: str) -> str:
    """Gemini 호출 — _CANDIDATE_MODELS 순서대로 시도, 첫 성공 모델 사용.

    404 NOT_FOUND / "not found" : 이 계정·API버전에서 모델 미지원 → 다음 모델
    429 / 503 등 일시적 오류    : 즉시 502 전파 (재시도 무의미)
    """
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.7,
    )
    last_err: Exception | None = None
    for model in _CANDIDATE_MODELS:
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            if model != _CANDIDATE_MODELS[0]:
                logger.warning("Used fallback model %s (primary unavailable)", model)
            return response.text
        except Exception as e:
            err_str = str(e)
            # 404 / "not found" → 해당 모델 미지원: 다음 모델 시도
            if "404" in err_str or "NOT_FOUND" in err_str or "not found" in err_str.lower():
                logger.warning(
                    "Model %s not available, trying next. err=%s",
                    model, err_str[:150],
                )
                last_err = e
                continue
            # 그 외 오류(429/500 등): 즉시 전파
            logger.error("Gemini API error (model=%s): %s", model, e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI 추천 서비스에 일시적인 오류가 발생했습니다.",
            )

    # 모든 후보 모델 실패
    logger.error(
        "All Gemini candidate models unavailable: %s. last_err=%s",
        _CANDIDATE_MODELS, last_err,
    )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI 서비스를 현재 사용할 수 없습니다. API 키의 모델 접근 권한을 확인해주세요.",
    )


async def generate_trip_plan(
    destination: str,
    days: int,
    preferences: str | None = None,
    user_top_categories: list[str] | None = None,
) -> AiTripPlan:
    """AI로 여행 일정을 생성.

    user_top_categories가 있으면 프롬프트에 추가 컨텍스트로 주입해
    사용자가 평소 좋아하는 카테고리를 반영한다 (사용자 선호 학습 기초).
    """
    client = _get_client()
    # 프롬프트 인젝션 방어
    safe_destination = _sanitize_user_input(destination, max_len=100)
    safe_preferences = _sanitize_user_input(preferences or "자유 여행", max_len=200)
    prompt = _PROMPT_TEMPLATE.format(
        destination=safe_destination,
        days=days,
        preferences=safe_preferences,
        total_locations=days * 4,
    )
    if user_top_categories:
        prompt += (
            "\n\n참고 — 이 사용자가 평소 자주 방문하는 카테고리(빈도 순): "
            + ", ".join(user_top_categories)
            + "\n위 카테고리를 일정에 적절히 반영해줘."
        )

    raw = await _call_gemini(client, prompt)

    try:
        data = _parse_json(raw)
        return AiTripPlan.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse Gemini response: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 응답 파싱에 실패했습니다.",
        )


# ─── Refine (부분 재생성) ──────────────────────────────────────────────────────

_REFINE_TEMPLATE = """\
사용자가 기존 여행 일정에서 일부 장소를 마음에 들어해서 유지하고 싶어해.
나머지 장소들을 사용자 피드백에 맞춰 새로 추천해줘. JSON으로만 응답해.

목적지: {destination}
여행 기간: {days}일
사용자 피드백: {feedback}

[유지할 장소 — 그대로 출력]
{keep_json}

목표 총 장소 수: {target_total}개

반환할 JSON 스키마:
{{
  "title": "여행 제목",
  "description": "여행 소개",
  "locations": [
    {{
      "name": "장소명",
      "address": "주소",
      "latitude": float,
      "longitude": float,
      "category": "관광지|음식점|숙소|쇼핑|카페|자연|문화|엔터테인먼트",
      "visit_order": int,
      "notes": "팁"
    }}
  ]
}}

조건:
- 유지할 장소는 반드시 포함하고 그 이름/좌표를 변경하지 마.
- 새로 추가할 장소는 사용자 피드백을 적극 반영.
- visit_order는 1부터 시작하는 일관된 순서.
- 총 {target_total}개에 맞춰서 새 장소를 채워줘.
"""


async def refine_trip_plan(req: AiRefineRequest) -> AiTripPlan:
    """기존 추천에서 일부 장소를 고정하고 나머지를 재생성."""
    client = _get_client()
    target_total = req.target_total or (req.days * 4)
    keep_dicts = [loc.model_dump() for loc in req.keep_locations]

    # 프롬프트 인젝션 방어
    safe_destination = _sanitize_user_input(req.destination, max_len=100)
    safe_feedback = _sanitize_user_input(req.feedback, max_len=300)
    prompt = _REFINE_TEMPLATE.format(
        destination=safe_destination,
        days=req.days,
        feedback=safe_feedback,
        keep_json=json.dumps(keep_dicts, ensure_ascii=False, indent=2),
        target_total=target_total,
    )

    raw = await _call_gemini(client, prompt)

    try:
        data = _parse_json(raw)
        plan = AiTripPlan.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse refine response: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 응답 파싱에 실패했습니다.",
        )

    # 사용자가 유지하라고 한 장소가 누락됐으면 후처리로 강제 보존
    plan = _ensure_kept_locations(plan, req.keep_locations)
    return plan


_DESTINATION_GUIDE_TEMPLATE = """\
다음 여행지에 대한 여행자 가이드를 JSON 형식으로만 생성해줘. JSON 외 다른 텍스트는 포함하지 마.

여행지: {destination}

반환할 JSON 스키마:
{{
  "destination": "{destination}",
  "country": "국가명",
  "currency": "통화 (예: JPY — 일본 엔)",
  "exchange_rate_krw": 1원당 현지 통화 환율(float, 모르면 null),
  "timezone": "시간대 (예: UTC+9)",
  "language": "주요 언어",
  "best_season": "최적 여행 시기 (예: 3~5월 봄)",
  "climate_now": "현재 계절/날씨 특징 (1~2문장)",
  "visa": "한국인 비자 요건 (예: 무비자 90일)",
  "transport": ["주요 교통수단 1", "주요 교통수단 2", ...],
  "top_areas": [
    {{"name": "지역명", "description": "특징 설명 (1문장)"}},
    ...
  ],
  "must_eat": ["반드시 먹어야 할 음식 1", "음식 2", ...],
  "tips": ["현지 꿀팁 1", "꿀팁 2", ...]
}}

조건:
- transport는 3~5개
- top_areas는 3~5개
- must_eat는 4~6개
- tips는 4~6개
- 모든 내용은 한국어로 작성
"""


async def generate_destination_guide(destination: str) -> DestinationGuide:
    """여행지 가이드를 AI로 생성. (DestinationGuide 반환)"""
    client = _get_client()
    safe_destination = _sanitize_user_input(destination, max_len=100)
    prompt = _DESTINATION_GUIDE_TEMPLATE.format(destination=safe_destination)

    raw = await _call_gemini(client, prompt)

    try:
        data = _parse_json(raw)
        return DestinationGuide.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse destination guide: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 가이드 응답 파싱에 실패했습니다.",
        )


def _ensure_kept_locations(plan: AiTripPlan, keep: list[AiLocationPlan]) -> AiTripPlan:
    """LLM이 keep 항목을 누락했을 때 강제 병합. 이름 기준 매칭."""
    if not keep:
        return plan
    present_names = {loc.name for loc in plan.locations}
    missing = [k for k in keep if k.name not in present_names]
    if not missing:
        return plan
    merged = list(plan.locations) + missing
    # visit_order 재정렬
    merged.sort(key=lambda x: x.visit_order)
    for i, loc in enumerate(merged, start=1):
        loc.visit_order = i
    return AiTripPlan(title=plan.title, description=plan.description, locations=merged)
