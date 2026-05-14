# Phase 5/6/7/8 — 디자인 시스템 + 인프라 정비 + 장소 검색 + AI 빌더

> 트리플 클론 앱 품질 고도화 로드맵의 4개 Phase 통합 PR.
> 화면 깜빡임 / 시안→코랄 톤 통일 / 좌표 직접 입력 → 검색·지도·내 주변 / AI 결과 편집 등 핵심 페인포인트 해결.

## 요약

| Phase | 핵심 변화 |
|---|---|
| **5** 디자인 시스템 | CSS 변수 기반 OS 다크모드 자동, 시맨틱 토큰, 공통 컴포넌트 라이브러리 |
| **8** 인프라 정비 | Zustand 전역 상태 + React Query 데이터 페칭 + Zod 응답 검증 |
| **6** 장소 검색 UX | Google Places API + 검색·지도·내 주변 3가지 입력 모드 |
| **7** AI 고도화 | trip+locations 일괄 저장, refine 부분 재생성, 카테고리 선호 자동 반영, 플랜 빌더 화면 |

총 6개 logical commit으로 단계별 분리.

---

## Phase 5 — 디자인 시스템 + 다크모드 정식 지원

### 디자인 토큰
- [mobile/lib/design-tokens.ts](mobile/lib/design-tokens.ts) — palette / lightColors / darkColors / `useThemedColors` 훅 / shadow / radius / typography
- [mobile/lib/categories.ts](mobile/lib/categories.ts) — 카테고리 단일 정의

### CSS 변수 기반 다크모드
- [mobile/global.css](mobile/global.css): `:root` 라이트 + `@media (prefers-color-scheme: dark) :root` 다크
- [mobile/tailwind.config.js](mobile/tailwind.config.js): `rgb(var(--color-...) / <alpha-value>)` 패턴
- **OS 시스템 모드 자동 추종** — 화면 코드 변경 없이 토큰 자동 전환

### 공통 컴포넌트 (`mobile/components/ui/`)
`Button` / `Card` / `BottomSheet` / `EmptyState` / `Chip` / `SegmentedControl` / `TextField` / `Skeleton`(shimmer)

### 도메인 컴포넌트
- `TripCard`: 좌측 컬러 strip + **D-day 뱃지** (`D-N` / `D-DAY` / `여행 중` / `완료`)
- `LocationCard`: explore/trip 상세 양쪽 재사용

### 톤 통일
인라인 cyan `#3DC3EE` → 브랜드 코랄 `#FF5A5F`로 일관 적용. 여행앱 감성으로 전환.

---

## Phase 8 — 상태/데이터/검증 인프라

### Zustand (`mobile/store/`)
- `authStore`: `AuthStatus: 'loading' | 'authenticated' | 'guest'` — 부팅 직후 라우팅 깜빡임 제거
- `networkStore`: NetInfo 리스너 root 1회, 화면은 `useIsOnline()`만 구독

### React Query (`mobile/lib/queries/`)
- `useTrips` / `useTrip` / `useCreate·Update·DeleteTrip` / `useCreate·DeleteLocation` / `usePlaceSearch`
- 옵티미스틱 `setQueryData`, SQLite hydrate, 디바운스 검색

### Zod 검증 (`mobile/lib/schemas.ts`)
- API 응답 + 폼 입력 모두 검증
- `safeParse` 헬퍼: dev 콘솔 경고 + graceful degradation (사용자 경험 깨지 않음)
- 좌표 ±90/±180, 'YYYY-MM-DD' 정규식, 출발일≤귀국일 등 비즈니스 규칙

---

## Phase 6 — 장소 검색 UX (좌표 직접 입력 폐기)

### 백엔드 — Google Places (New) Text Search 어댑터
- [backend/app/services/places_service.py](backend/app/services/places_service.py)
  - `locationBias`(반경 50km)로 사용자 위치 편향
  - Google place type → 앱 카테고리 자동 매핑
  - `photo.name` → media URL 변환 (`X-Goog-FieldMask`로 비용 절감)
- `GET /places/search?query=...&lat=...&lng=...` (JWT 보호)
- `.env`에 `GOOGLE_PLACES_API_KEY` 추가

### 모바일 — 풀스크린 라우트 3 모드
- [mobile/app/trips/[id]/add-location.tsx](mobile/app/trips/[id]/add-location.tsx)
  - **🔎 검색**: 300ms 디바운스 자동완성 + 사진/주소/평점 카드
  - **🗺️ 지도**: 탭/롱프레스 핀 → `Location.reverseGeocodeAsync`로 주소 자동
  - **📍 내 주변**: `expo-location` 권한 + 빠른 칩(맛집/카페/관광지/쇼핑/편의시설)
- `trips/[id].tsx` → `trips/[id]/index.tsx` 이동 (하위 라우트 공존)
- 카테고리 자동 매핑 + 메모 + 저장 푸터

---

## Phase 7 — AI 추천 편집 가능 + 사용자 선호 반영

### 백엔드
- `TripCreate.locations`: trip + 장소들을 한 번에 생성 가능 (AI 빌더 저장 흐름의 핵심)
- `POST /ai/recommend/refine`: 마음에 든 장소 유지 + 사용자 피드백으로 부분 재생성
  - `_ensure_kept_locations()` 후처리로 LLM이 keep 항목 누락 시 강제 병합
- `GET /ai/recommend`: 현재 user의 과거 카테고리 빈도 상위 3개를 프롬프트에 자동 주입
  - **DB 변경 없이** 즉석 추출 (`TripRepository.get_top_categories`)

### 모바일 — AI 플랜 빌더 화면
- [mobile/app/ai/builder.tsx](mobile/app/ai/builder.tsx)
- 추천 결과를 통째로 저장하던 한계 해결:
  - 체크박스로 포함/제외
  - Day 1..N 칩으로 일자 배정
  - 🔄 재생성 모달 (피드백 + 빠른 칩 야경/맛집/한적/가족)
  - 저장 시 Day 순서 → `visit_order` 재계산해 한 번에 POST
- explore: 결과 카드 액션이 **3개**로 분기 — 편집 / 즉시 저장 / 다시 추천

---

## 사전 작업 (배포 전 필요)

### 백엔드 `.env` 환경 변수 추가
```bash
# Google Places API (New) 활성화 필요
GOOGLE_PLACES_API_KEY="..."
```

### 의존성
```bash
# 백엔드 (httpx를 runtime으로 이동)
cd backend && uv sync

# 모바일 (zustand, @tanstack/react-query, zod, expo-location)
cd mobile && npm install
```

### iOS 권한 (Info.plist는 Expo가 자동, 필요 시 app.json에 명시)
- `NSLocationWhenInUseUsageDescription`: 현재 위치 기반 장소 추천

---

## 테스트 체크리스트

### 라이트/다크 모드
- [ ] 시뮬레이터 `⌘⇧A`로 다크 전환 시 모든 화면 자연스럽게 색 반전
- [ ] 코랄/터쿼이즈 브랜드 색은 양쪽에서 동일 유지

### 트립 CRUD + 옵티미스틱 업데이트
- [ ] 트립 생성/수정/삭제 — 서버 응답 전 UI 즉시 갱신
- [ ] 비행기 모드 → 오프라인 배너 + 로컬 SQLite 표시 유지
- [ ] 네트워크 복원 시 자동 동기화

### 트립 카드
- [ ] 출발일/귀국일 입력 시 D-day 뱃지 표시 (`D-N`/`D-DAY`/`여행 중`/`완료`)

### 장소 추가 (검색/지도/내 주변)
- [ ] 검색: "도쿄 타워" 입력 → 디바운스 후 결과 리스트 표시
- [ ] 지도 모드: 핀 드롭 → 주소 자동 채움
- [ ] 내 주변: 권한 허용 후 현재 위치 기반 추천
- [ ] 백엔드 `/places/search` 200 OK + 카테고리 자동 매핑

### AI 빌더
- [ ] explore에서 추천 받음 → "✏️ 일정 편집" → builder 진입
- [ ] 체크박스 토글, Day 배정, 재생성 모달, 저장 후 trip 생성 확인
- [ ] 두 번째 추천부터 사용자 선호 카테고리가 프롬프트에 반영되는지 (로그 확인)

---

## 변경 통계

```
 6 commits, 60+ files changed
 ~4,500 insertions / ~1,300 deletions
 신규: design-tokens / store / queries / schemas / components/ui /
       TripCard / LocationCard / PlaceSearchInput / add-location / ai/builder /
       backend places + refine
```

---

## 다음 단계 (별도 PR 권장)

- **Phase 7.3 pgvector 의미 검색** — Gemini Embedding API + Alembic 마이그레이션 + `Location.embedding` + 유사 장소 추천 라우트
- **Phase 8.4 오프라인 쓰기 큐** — 비행기 모드에서 trip 생성 → 온라인 복귀 시 자동 sync
- **Phase 8.5 백엔드 운영 강화** — slowapi rate limit, structlog, JWT_SECRET 강제 검증
- **Phase 8.6 페이지네이션** — cursor 기반 무한 스크롤
- **Phase 9 사진 첨부 / 공유 / 푸시 알림 등 차별화 기능**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
