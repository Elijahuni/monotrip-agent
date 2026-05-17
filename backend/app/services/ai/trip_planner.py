"""여행 일정 생성 및 부분 재생성 (generate_trip_plan / refine_trip_plan)."""

import asyncio
import json
import logging

from fastapi import HTTPException, status

from app.schemas.ai import AiLocationPlan, AiRefineRequest, AiTripPlan

from .gemini_client import call_gemini, get_client, parse_json_response
from .redis_cache import get_recent_recommendations, push_recent_recommendation
from .prompt_builder import (
    TRIP_PLAN_TEMPLATE,
    REFINE_TEMPLATE,
    VALID_WEATHER_CODES,
    build_style_constraints,
    build_weather_constraints,
    get_current_date_str,
    get_current_season,
    resolve_travel_style,
    sanitize_user_input,
)
from .trend_fetcher import fetch_trending_spots

logger = logging.getLogger(__name__)


async def generate_trip_plan(
    destination: str,
    days: int,
    preferences: str | None = None,
    user_top_categories: list[str] | None = None,
    travel_style: str | None = None,
    weather_temp_c: float | None = None,
    weather_code: int | None = None,
    rain_chance: int | None = None,
    vibe_preference: list[str] | None = None,
    user_id: int | None = None,
) -> AiTripPlan:
    """AI로 여행 일정을 생성.

    travel_style: explore 화면 TRAVEL_STYLES key ('food'|'shopping'|'nature'|'activity'|'history').
    preferences: 자유 텍스트 취향 ("맛집 위주" 등).
    두 값을 합쳐 스타일 제약을 동적으로 생성.
    Google Search Grounding으로 목적지 실시간 트렌드를 조회해 프롬프트에 주입
    (create_task()로 즉시 시작, 동기 준비 코드와 I/O 오버랩).
    weather_temp_c / weather_code / rain_chance: wttr.in 에서 가져온 목적지 현재 날씨.
    """
    client = get_client()

    # weather_code 화이트리스트 검증 — 알 수 없는 코드는 None으로 처리
    # (CRITICAL-2: 클라이언트 공급 값이므로 프롬프트 주입 방지)
    safe_weather_code: int | None = weather_code
    if weather_code is not None and weather_code not in VALID_WEATHER_CODES:
        logger.warning(
            "Unknown weather_code %d from client, ignoring (not in wttr.in spec)", weather_code
        )
        safe_weather_code = None

    # 프롬프트 인젝션 방어
    safe_destination = sanitize_user_input(destination, max_len=100)
    safe_preferences = sanitize_user_input(preferences or "", max_len=200)
    safe_style = sanitize_user_input(travel_style or "", max_len=50)

    # travel_style key → 한국어 변환 + preferences 합산 → 통합 스타일 컨텍스트
    style_context = resolve_travel_style(safe_style or None, safe_preferences or None)
    style_constraints = build_style_constraints(style_context)

    season = get_current_season()
    current_date = get_current_date_str()

    # ── Google Search Grounding 트렌드 조회 ────────────────────────────────────
    # create_task()로 네트워크 요청을 이벤트 루프에 즉시 등록한 뒤,
    # 아래 동기 준비 코드(날씨 섹션 빌드 등)가 실행되는 동안 OS 레벨 I/O가 진행됨.
    # await는 동기 준비가 끝난 직후 — 결과가 이미 도착했다면 즉시 반환됨.
    # fetch_trending_spots 내부에서 10초 timeout + 예외 처리를 담당하므로
    # await trending_task는 항상 str | None을 반환하고 예외를 전파하지 않음.
    trending_task: asyncio.Task[str | None] = asyncio.create_task(
        fetch_trending_spots(client, safe_destination, style_context)
    )

    # 날씨 섹션 빌드 (safe_weather_code: whitelist 검증 완료된 값)
    # — 동기 코드로 trending I/O와 동시에 진행
    if weather_temp_c is not None:
        rain_hint = f", 강우확률 {rain_chance}%" if rain_chance is not None else ""
        weather_constraints = build_weather_constraints(
            weather_temp_c, safe_weather_code, rain_chance
        )
        weather_section = (
            f"[현재 목적지 날씨] 기온: {weather_temp_c:.0f}°C{rain_hint}\n{weather_constraints}"
        )
        logger.info(
            "Weather injected for %s: temp=%.1f code=%s rain=%s",
            safe_destination,
            weather_temp_c,
            safe_weather_code,
            rain_chance,
        )
    else:
        weather_section = ""

    # 트렌딩 결과 수집 — 동기 준비가 끝난 시점에 await
    # (네트워크 I/O는 이미 진행 중이므로 대기 시간이 단축됨)
    trending_spots = await trending_task
    trending_section = (
        f"[실시간 트렌딩 장소 — 가능하면 일정에 포함]\n{trending_spots}" if trending_spots else ""
    )

    prompt = TRIP_PLAN_TEMPLATE.format(
        destination=safe_destination,
        days=days,
        style_context=style_context,
        season=season,
        current_date=current_date,
        total_locations=days * 4,
        style_constraints=style_constraints,
        trending_section=trending_section,
        weather_section=weather_section,
    )
    if user_top_categories:
        prompt += (
            "\n\n참고 — 이 사용자가 평소 자주 방문하는 카테고리(빈도 순): "
            + ", ".join(user_top_categories)
            + "\n위 카테고리를 일정에 적절히 반영해줘."
        )

    if vibe_preference:
        # vibe는 사용자가 큐레이션 화면 등에서 선택한 태그.
        # 화이트리스트 검증은 호출 측(라우터/서비스)에서 이미 수행되었다고 가정하되,
        # 안전 차원에서 길이를 다시 자른다.
        safe_vibes = [sanitize_user_input(v, max_len=20) for v in vibe_preference[:6]]
        prompt += (
            "\n\n[Vibe 선호 — 선택한 분위기]\n"
            + ", ".join(safe_vibes)
            + "\n→ 위 분위기와 어울리는 카페·식당·포토스팟·동선을 우선 추천해줘."
        )

    # ── 최근 추천 다양성 — 이전 추천 장소는 제외 요청 ─────────────────────────
    recent_exclude: list[str] = []
    if user_id is not None:
        recent = await get_recent_recommendations(user_id)
        for rec in recent:
            if isinstance(rec, dict) and rec.get("destination") == safe_destination:
                names = rec.get("names", [])
                if names:
                    recent_exclude.extend(names[:10])
    if recent_exclude:
        prompt += (
            "\n\n[다양성 확보 — 아래 장소들은 이전 추천에 포함된 적 있으니 가능하면 다른 곳을 추천]\n"
            + ", ".join(recent_exclude[:20])
        )

    raw = await call_gemini(client, prompt)

    try:
        data = parse_json_response(raw)
        plan = AiTripPlan.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse Gemini response: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 응답 파싱에 실패했습니다.",
        )

    # 결과 장소 이름을 최근 추천 캐시에 저장 (비동기, 실패 무시)
    if user_id is not None:
        import asyncio as _asyncio

        _asyncio.create_task(
            push_recent_recommendation(
                user_id,
                safe_destination,
                [loc.name for loc in plan.locations],
            )
        )

    return plan


async def refine_trip_plan(req: AiRefineRequest) -> AiTripPlan:
    """기존 추천에서 일부 장소를 고정하고 나머지를 재생성."""
    client = get_client()
    target_total = req.target_total or (req.days * 4)
    keep_dicts = [loc.model_dump() for loc in req.keep_locations]

    safe_destination = sanitize_user_input(req.destination, max_len=100)
    safe_feedback = sanitize_user_input(req.feedback, max_len=300)
    prompt = REFINE_TEMPLATE.format(
        destination=safe_destination,
        days=req.days,
        feedback=safe_feedback,
        keep_json=json.dumps(keep_dicts, ensure_ascii=False, indent=2),
        target_total=target_total,
    )

    raw = await call_gemini(client, prompt)

    try:
        data = parse_json_response(raw)
        plan = AiTripPlan.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse refine response: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 응답 파싱에 실패했습니다.",
        )

    # LLM이 keep 항목을 누락했을 때 강제 병합
    plan = _ensure_kept_locations(plan, req.keep_locations)
    return plan


def _ensure_kept_locations(plan: AiTripPlan, keep: list[AiLocationPlan]) -> AiTripPlan:
    """LLM이 keep 항목을 누락했을 때 강제 병합. 이름 기준 매칭."""
    if not keep:
        return plan
    present_names = {loc.name for loc in plan.locations}
    missing = [k for k in keep if k.name not in present_names]
    if not missing:
        return plan
    merged = list(plan.locations) + missing
    merged.sort(key=lambda x: x.visit_order)
    for i, loc in enumerate(merged, start=1):
        loc.visit_order = i
    return AiTripPlan(title=plan.title, description=plan.description, locations=merged)
