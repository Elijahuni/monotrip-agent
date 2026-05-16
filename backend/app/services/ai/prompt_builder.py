"""프롬프트 구성 유틸리티 — 입력 정제·스타일·날씨 제약·템플릿."""
import re
from datetime import datetime, timezone

# ─── wttr.in weatherCode 전체 유효 집합 (CRITICAL-2: 클라이언트 입력 whitelist) ─
# https://www.worldweatheronline.com/weather-api/api/docs/weather-description-codes.aspx
VALID_WEATHER_CODES: frozenset[int] = frozenset({
    113, 116, 119, 122,                        # 맑음 / 구름
    143, 248, 260,                             # 안개
    176, 179, 182, 185,                        # 가벼운 비·눈·진눈깨비
    200,                                        # 천둥
    227, 230,                                  # 눈보라
    263, 266,                                  # 가랑비
    281, 284,                                  # 얼어붙는 이슬비
    293, 296, 299, 302, 305, 308,             # 비
    311, 314, 317, 320,                        # 어는 비·진눈깨비
    323, 326, 329, 332, 335, 338, 350,        # 눈·얼음 입자
    353, 356, 359,                             # 소나기
    362, 365, 368, 371, 374, 377,             # 눈·진눈깨비 소나기
    386, 389, 392, 395,                        # 뇌우 동반
})

# ─── 눈·결빙 wttr.in weatherCode 집합 (모듈 상수 — 호출마다 재생성 방지) ───────
SNOW_CODES: frozenset[int] = frozenset({
    179, 182, 185, 281, 284,   # 얼음/진눈깨비
    311, 314, 317, 320,        # 슬릿/눈비
    362, 365, 374, 377,        # 눈
})

# ─── 모바일 travel_style key → 한국어 레이블 ─────────────────────────────────
STYLE_KEY_MAP: dict[str, str] = {
    "food":     "미식 맛집",
    "shopping": "쇼핑",
    "nature":   "자연 힐링",
    "activity": "액티비티",
    "history":  "역사 문화",
}

# ─── 여행 일정 프롬프트 템플릿 ────────────────────────────────────────────────
TRIP_PLAN_TEMPLATE = """\
다음 조건에 맞는 여행 일정을 JSON 형식으로만 생성해줘. JSON 외의 다른 텍스트는 포함하지 마.

목적지: {destination}
여행 기간: {days}일
여행 스타일: {style_context}
현재 시즌: {season}
기준 날짜: {current_date}

{trending_section}
{weather_section}

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
      "notes": "방문 팁 또는 추천 이유 (시즌 특화 정보 포함)"
    }}
  ]
}}

조건:
- 하루에 4~5개 장소 포함 (총 {total_locations}개 내외)
- 실제 존재하는 장소의 정확한 위도/경도 제공
- category는 반드시 "관광지", "음식점", "숙소", "쇼핑", "액티비티" 중 하나
{style_constraints}
- visit_order는 전체 일정에서 방문 순서 (1, 2, 3, ...)
- 여행 스타일과 현재 시즌({season})을 제목·장소 선택·notes에 충실히 반영할 것
- 위 트렌딩 장소가 있으면 일정에 자연스럽게 포함 (스타일에 맞는 경우)
- 날씨 정보가 제공된 경우 반드시 날씨 제약에 따라 장소 유형을 조정할 것
"""

# ─── 부분 재생성 템플릿 ────────────────────────────────────────────────────────
REFINE_TEMPLATE = """\
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

# ─── 여행지 가이드 템플릿 ──────────────────────────────────────────────────────
DESTINATION_GUIDE_TEMPLATE = """\
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

# ─── 날씨로 여행지 찾기 템플릿 ────────────────────────────────────────────────
BY_WEATHER_TEMPLATE = """\
지금 {condition_label} 날씨를 즐길 수 있는 세계 여행지를 추천해줘.
기준 날짜: {current_date}

반환할 JSON 스키마 (```json ``` 블록 없이 순수 JSON만):
{{
  "destinations": [
    {{
      "city": "도시명 (한국어)",
      "country": "국가명 (한국어)",
      "reason": "왜 이 날씨에 이 도시를 추천하는지 2~3문장",
      "weather_desc": "현재 시점 실제 날씨 설명 (1문장, {condition_label} 조건 기준)",
      "sample_locations": ["대표 장소 1", "대표 장소 2", "대표 장소 3"]
    }}
  ]
}}

조건:
- destinations는 정확히 3개
- 각 도시는 서로 다른 대륙/권역
- 현재 {current_date} 기준으로 실제 그 날씨인 도시 우선 (북반구/남반구 계절 고려)
- 모든 내용은 한국어로 작성
- JSON 외 텍스트 절대 포함 금지
"""


# ─── 유틸리티 함수들 ───────────────────────────────────────────────────────────

def sanitize_user_input(text: str, max_len: int = 200) -> str:
    """프롬프트 인젝션 방어 — HTML 태그와 LLM 역할 전환 키워드 제거."""
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = re.sub(
        r"\b(ignore|forget|disregard|override|system|assistant|user)\s*[:\-]\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned[:max_len].strip()


def get_current_season() -> str:
    """UTC 기준 현재 월 → 시즌 문자열."""
    month = datetime.now(timezone.utc).month
    if month in (3, 4, 5):   return "봄 (벚꽃·나들이 시즌)"
    if month in (6, 7, 8):   return "여름 (더위·휴가 시즌)"
    if month in (9, 10, 11): return "가을 (단풍·선선한 날씨)"
    return "겨울 (연말·크리스마스 시즌)"


def get_current_date_str() -> str:
    """UTC 기준 현재 날짜 → 'YYYY년 MM월 DD일' 포맷."""
    return datetime.now(timezone.utc).strftime("%Y년 %m월 %d일")


def resolve_travel_style(travel_style: str | None, preferences: str | None) -> str:
    """travel_style key + preferences 자유텍스트 → 통합 컨텍스트 문자열.

    - 둘 다 없으면 '자유 여행' 반환
    - travel_style key가 있으면 STYLE_KEY_MAP을 통해 한국어로 변환
    """
    parts: list[str] = []
    if travel_style:
        parts.append(STYLE_KEY_MAP.get(travel_style, travel_style))
    if preferences and preferences.strip():
        parts.append(preferences.strip())
    return " ".join(parts) if parts else "자유 여행"


def build_weather_constraints(
    temp_c: float | None,
    weather_code: int | None,
    rain_chance: int | None,
) -> str:
    """실시간 날씨 데이터를 기반으로 장소 구성 안내 문구 생성.

    우선순위: 눈/결빙 > 강우확률 > 폭염/혹한 > 쾌적
    temp_c가 None이면 빈 문자열 반환 (날씨 섹션 비활성화).
    """
    if temp_c is None:
        return ""

    lines: list[str] = []
    is_snowy = weather_code is not None and weather_code in SNOW_CODES

    if is_snowy:
        lines.append(
            "- 눈/결빙 예보 — 겨울 특화 실내 명소(온천·스키장·눈 테마파크 등) 위주로 배치\n"
            "- 야외 이동이 많은 장소는 최소화"
        )
    elif rain_chance is not None and rain_chance > 60:
        lines.append(
            f"- 강우확률 {rain_chance}%의 비 예보 — 실내 관광지·카페·음식점 위주 배치\n"
            "- 야외 장소는 지붕 있는 곳 또는 실내 대안으로 대체"
        )
    elif temp_c < 5:
        lines.append(
            f"- 기온 {temp_c:.0f}°C의 혹한 — 따뜻한 실내 체험·온천·실내 식당 위주 배치\n"
            "- 야외 장소는 아침보다 낮 시간대에 배치하고 체류 시간 단축"
        )
    elif temp_c > 32:
        lines.append(
            f"- 기온 {temp_c:.0f}°C의 폭염 — 오전·저녁에 야외, 낮(12~15시) 시간대는 실내(카페·박물관·쇼핑몰) 위주\n"
            "- 냉방이 잘 되는 실내 장소를 적극 활용"
        )
    else:
        rain_hint = f" (강우확률 {rain_chance}%)" if rain_chance is not None else ""
        lines.append(
            f"- 기온 {temp_c:.0f}°C{rain_hint}의 쾌적한 날씨 — 야외·실내 균형 있게 배치 가능"
        )

    return "\n".join(lines)


def build_style_constraints(style_context: str) -> str:
    """통합 스타일 컨텍스트를 분석해 장소 구성 비율 제약을 동적으로 생성.

    travel_style key는 resolve_travel_style에서 이미 한국어로 변환된 상태.
    """
    p = style_context.lower()

    if any(k in p for k in ["미식", "맛집", "음식", "식도락", "푸드", "먹방"]):
        return (
            "- 음식점은 하루에 3~4개 포함 (미식 중심이므로 최우선 배치)\n"
            "- 숙소는 하루에 1개 포함\n"
            "- 관광지·쇼핑은 0~1개로 최소화; 음식 관련 시장·카페·포장마차도 포함 가능"
        )

    if any(k in p for k in ["자연", "힐링", "등산", "트레킹", "하이킹", "캠핑"]):
        return (
            "- 자연 명소·공원·산책로·힐링 스팟을 하루에 2~3개 포함\n"
            "- 숙소는 하루에 1개, 음식점은 1~2개\n"
            "- 쇼핑·번화가 장소는 최소화"
        )

    if any(k in p for k in ["액티비티", "activity"]):
        return (
            "- 체험형 액티비티(스포츠·투어·워크숍 등)를 하루에 2~3개 포함\n"
            "- 숙소는 하루에 1개, 음식점은 1~2개"
        )

    if any(k in p for k in ["쇼핑", "마켓", "백화점"]):
        return (
            "- 쇼핑몰·마켓·거리 쇼핑 장소를 하루에 2~3개 포함\n"
            "- 숙소는 하루에 1개, 음식점은 1~2개"
        )

    if any(k in p for k in ["역사", "문화", "박물관", "유적", "전통"]):
        return (
            "- 박물관·유적·문화시설·역사 명소를 하루에 2~3개 포함\n"
            "- 숙소는 하루에 1개, 음식점은 1~2개"
        )

    # 기본: 스타일 미선택 → 균형 있는 자유 여행
    return (
        "- 숙소는 하루에 1개 포함\n"
        "- 음식점은 하루에 1~2개 포함\n"
        "- 관광지·문화·쇼핑·액티비티를 고르게 배치해 전형적인 여행 일정 구성"
    )
