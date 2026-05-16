"""ai_service — 얇은 re-export facade.

기존 코드(routes, tests)는 이 모듈에서 직접 import하므로
내부 구현을 services/ai/ 서브패키지로 분리한 뒤에도
공개 인터페이스는 이 파일을 통해 유지한다.

실제 구현:
  services/ai/gemini_client.py  — Gemini 클라이언트·폴백·파싱
  services/ai/prompt_builder.py — 프롬프트 템플릿·입력 정제·제약 생성
  services/ai/trend_fetcher.py  — Google Search Grounding 트렌딩 조회
  services/ai/trip_planner.py   — 일정 생성·refine
  services/ai/destination_guide.py — 여행지 가이드
  services/ai/weather_planner.py   — 날씨 기반 여행지 추천
"""

# ── 공개 서비스 함수 ─────────────────────────────────────────────────────────
from app.services.ai.trip_planner import generate_trip_plan, refine_trip_plan
from app.services.ai.destination_guide import generate_destination_guide
from app.services.ai.weather_planner import generate_by_weather_plan, WEATHER_CONDITION_LABELS

# ── 테스트·내부 호환 별칭 (_-prefix 유지) ────────────────────────────────────
from app.services.ai.prompt_builder import (
    build_style_constraints as _build_style_constraints,
    build_weather_constraints as _build_weather_constraints,
    resolve_travel_style as _resolve_travel_style,
    sanitize_user_input as _sanitize_user_input,
    get_current_season as _get_current_season,
    STYLE_KEY_MAP as _STYLE_KEY_MAP,
    SNOW_CODES as _SNOW_CODES,
)
from app.services.ai.gemini_client import (
    CANDIDATE_MODELS as _CANDIDATE_MODELS,
    get_client as _get_client,
    parse_json_response as _parse_json,
    call_gemini as _call_gemini,
)

__all__ = [
    # 공개 서비스
    "generate_trip_plan",
    "refine_trip_plan",
    "generate_destination_guide",
    "generate_by_weather_plan",
    "WEATHER_CONDITION_LABELS",
    # 내부 호환 (테스트 import 유지)
    "_build_style_constraints",
    "_build_weather_constraints",
    "_resolve_travel_style",
    "_sanitize_user_input",
    "_get_current_season",
    "_STYLE_KEY_MAP",
    "_SNOW_CODES",
    "_CANDIDATE_MODELS",
    "_get_client",
    "_parse_json",
    "_call_gemini",
]
