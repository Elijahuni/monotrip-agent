# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 코드를 작업할 때 따라야 할 개발 규칙과 아키텍처 가이드를 제공합니다.

## 프로젝트 개요

**트리플 클론 AI 여행 앱** — 모노레포 기반의 AI 기반 여행 계획 애플리케이션. 모바일 우선 오프라인 지원 구조와 강력한 백엔드 AI 추천 엔진을 특징으로 함.

---

## 1. 아키텍처 및 기술 스택

### 프론트엔드 (/mobile)
- **프레임워크**: React Native + Expo Router
- **스타일링**: NativeWind (Tailwind CSS for React Native)
- **상태 관리**: TBD (Redux, Zustand, Context 등)
- **로컬 DB**: SQLite (오프라인 우선 데이터 저장)
- **네트워킹**: Axios 또는 Fetch API

### 백엔드 (/backend)
- **언어**: Python 3.12+
- **프레임워크**: FastAPI
- **ORM**: SQLAlchemy 2.x (비동기 AsyncSession)
- **비동기 런타임**: asyncio (uvicorn)
- **검증**: Pydantic v2

### 데이터베이스
- **주 DB**: PostgreSQL 16
- **벡터 DB**: pgvector 확장 (AI 추천 임베딩)
- **캐싱**: Redis (선택사항)

### 개발 도구
- **패키지 관리**: uv (backend), npm (mobile)
- **환경 변수**: .env (pydantic-settings)
- **버전 제어**: Git (branch: main, develop, feature/*)
- **배포**: TBD (Docker, K8s, Vercel, Heroku 등)

---

## 2. 백엔드 개발 절대 규칙 (FastAPI)

### 2.1 클린 아키텍처 엄수 (4계층 분리)

코드는 항상 다음 4개의 계층으로 분리해야 합니다:

```
backend/
├── app/
│   ├── routes/           # HTTP 요청/응답 처리 (Pydantic 검증만)
│   ├── services/         # 비즈니스 로직 & AI 호출
│   ├── repositories/     # DB 접근 (SQLAlchemy)
│   ├── models/           # DB 스키마 정의
│   ├── schemas/          # Pydantic 요청/응답 모델
│   └── dependencies/     # 의존성 주입 (DB 세션 등)
```

#### routes/ 계층
- **역할**: HTTP 요청 수신 → 데이터 검증(Pydantic) → Service 호출 → 응답 반환
- **금지**: DB 쿼리 직접 실행, 비즈니스 로직 작성
- **예시**:
```python
@router.get("/trips/{trip_id}")
async def get_trip(trip_id: int, service: TripService = Depends()):
    trip = await service.get_trip_by_id(trip_id)
    return {"success": True, "data": trip}
```

#### services/ 계층
- **역할**: 비즈니스 로직, AI 호출(Gemini, Claude), 복잡한 계산
- **금지**: DB 직접 쿼리 (반드시 repository 호출)
- **예시**:
```python
class TripService:
    def __init__(self, repo: TripRepository):
        self.repo = repo
    
    async def create_trip_with_ai_recommendation(self, user_id: int):
        # 1. 사용자 정보를 repository에서 조회
        user = await self.repo.get_user(user_id)
        
        # 2. AI 호출 (Gemini, Claude 등)
        recommendations = await call_gemini_api(user.preferences)
        
        # 3. DB에 저장
        trip = await self.repo.create_trip(user_id, recommendations)
        return trip
```

#### repositories/ 계층
- **역할**: SQLAlchemy를 통한 DB 접근만 담당
- **금지**: 비즈니스 로직, 조건부 분기
- **예시**:
```python
class TripRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_trip_by_id(self, trip_id: int) -> Trip:
        stmt = select(Trip).where(Trip.id == trip_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()
```

#### models/ 계층
- **역할**: SQLAlchemy 테이블 스키마 정의
- **예시**:
```python
class Trip(Base):
    __tablename__ = "trips"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

### 2.2 비동기 처리 (AsyncSession, select() 패턴)

**반드시 사용할 패턴:**
```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_user(db: AsyncSession, user_id: int):
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalars().first()
```

**절대 금지하는 패턴:**
```python
# ❌ 동기식 query() — 금지
user = db.query(User).filter(User.id == user_id).first()

# ❌ 동기식 session — 금지
from sqlalchemy.orm import Session
def get_user(db: Session, user_id: int):
    return db.query(User).first()
```

**관계 로딩:**
```python
# ✅ selectinload (권장)
from sqlalchemy.orm import selectinload
stmt = select(Trip).options(selectinload(Trip.locations))

# ✅ joinedload (필요시)
from sqlalchemy.orm import joinedload
stmt = select(Trip).options(joinedload(Trip.user))
```

### 2.3 보안 규칙

- **비밀번호 & API 키**: 절대 코드에 하드코딩하지 않음
- **환경 변수 사용**: `.env` 파일 → `python-dotenv` → `os.getenv()` 또는 `pydantic Settings`
- **예시**:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    gemini_api_key: str
    jwt_secret: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```

- **.env.example 유지**: 모든 환경 변수 목록을 `.env.example`에 작성
- **민감한 로그 제거**: 비밀번호, 토큰 등을 로그에 출력하지 않음

### 2.4 API 응답 표준화

모든 API 응답은 다음 형식을 따릅니다:
```python
{
  "success": true,
  "data": {...},
  "message": "success" | "error message"
}
```

---

## 3. 프론트엔드 개발 절대 규칙 (Expo/React Native)

### 3.1 Local-First 원칙

**모바일 앱은 오프라인에서도 작동해야 합니다.**

데이터 흐름:
```
백엔드 (API)
    ↓ (데이터 가져오기)
로컬 DB (SQLite)
    ↓ (읽기)
React State
    ↓
UI 화면 렌더링
```

**구현 패턴:**
```typescript
// ✅ 올바른 방식
useEffect(() => {
  // 1. 로컬 DB에서 먼저 읽기
  const localData = await localDB.getTrips();
  setTrips(localData);
  
  // 2. 백엔드에서 최신 데이터 가져오기
  const remoteData = await api.getTrips();
  
  // 3. 로컬 DB 업데이트
  await localDB.updateTrips(remoteData);
  setTrips(remoteData);
}, []);

// ❌ 금지되는 방식
// UI가 로컬 DB를 무시하고 API만 호출
```

**오프라인 감지 & 동기화:**
```typescript
import NetInfo from "@react-native-community/netinfo";

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected) {
      // 백그라운드 동기화 시작
      syncLocalDataWithBackend();
    }
  });
  return unsubscribe;
}, []);
```

### 3.2 스타일링 (NativeWind 우선)

**NativeWind (Tailwind CSS for React Native) 클래스를 최우선으로 사용:**

```tsx
// ✅ 권장
<View className="flex flex-1 bg-white p-4">
  <Text className="text-lg font-bold text-gray-900">여행 계획</Text>
  <ScrollView className="flex-1 mt-4">
    {/* 내용 */}
  </ScrollView>
</View>

// ❌ StyleSheet 사용 최소화
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  title: { fontSize: 18, fontWeight: 'bold' },
});
<View style={styles.container}>
  <Text style={styles.title}>여행 계획</Text>
</View>
```

**tailwind.config.js 설정 (필수):**
```javascript
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("nativewind/tailwind/css")],
};
```

### 3.3 상태 관리 & 의존성 주입

- **로컬 상태**: `useState` (간단한 컴포넌트)
- **전역 상태**: Redux, Zustand, 또는 Context API
- **데이터 페칭**: React Query 또는 SWR 권장
- **로컬 DB**: SQLite + `expo-sqlite` 또는 `react-native-sqlite-storage`

---

## 4. Claude Code 작업 규칙

### 4.1 코드 수정 전 분석

코드를 수정하기 전:
1. 해당 파일의 전체 구조를 `Read` 도구로 확인
2. 관련 파일들(routes, services, repositories) 간의 의존성 파악
3. 기존 패턴과 컨벤션 이해
4. 수정 범위 최소화 (과도한 리팩토링 지양)

### 4.2 에러 처리 (근본 원인 파악)

**겉으로 보이는 증상만 숨기지 말 것:**
```python
# ❌ 나쁜 예: 에러를 무시하고 None 반환
try:
    trip = await get_trip(trip_id)
except Exception:
    return None  # 왜 실패했는지 불명)

# ✅ 좋은 예: 근본 원인 파악 및 로깅
try:
    trip = await get_trip(trip_id)
except ValueError as e:
    logger.error(f"Invalid trip_id: {trip_id}, error: {e}")
    raise HTTPException(status_code=400, detail="유효하지 않은 trip_id")
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="서버 오류")
```

### 4.3 타입 어노테이션 (필수)

**정당한 사유 없이 `Any` 타입을 사용하지 말 것:**

```python
# ❌ 나쁜 예
async def process_data(data: Any) -> Any:
    return data

# ✅ 좋은 예
async def process_data(data: Trip) -> dict:
    return {"id": data.id, "title": data.title}

# ✅ 복잡한 타입도 명시
from typing import Optional, List
async def get_trips(
    user_id: int,
    filters: Optional[TripFilter] = None,
) -> List[TripResponse]:
    ...

# ✅ Pydantic 모델 활용
class TripResponse(BaseModel):
    id: int
    title: str
    locations: List[LocationResponse]
```

**TypeScript (프론트엔드)도 동일:**
```typescript
// ❌ 금지
const handleTrip = (trip: any) => {};

// ✅ 필수
interface Trip {
  id: number;
  title: string;
  locations: Location[];
}
const handleTrip = (trip: Trip) => {};
```

---

## 5. 개발 워크플로우

### 백엔드 개발 순서

1. **routes 작성**: HTTP 엔드포인트 정의 (Pydantic 스키마)
2. **services 작성**: 비즈니스 로직 구현
3. **repositories 작성**: DB 쿼리 구현
4. **models 작성**: 필요하면 DB 스키마 추가
5. **테스트**: pytest로 엔드투엔드 테스트

### 프론트엔드 개발 순서

1. **화면 컴포넌트 설계**: NativeWind로 레이아웃 구성
2. **로컬 상태 관리**: useState, Context 등
3. **로컬 DB 스키마**: SQLite 테이블 정의
4. **API 호출**: 백엔드와 통신
5. **오프라인 동기화**: 네트워크 감지 & 로컬 DB 동기화

---

## 6. 공통 명령어 및 설정

### 백엔드 (Python/FastAPI)
```bash
# 의존성 설치
uv sync

# 패키지 추가
uv add <package>

# 개발 서버 실행
uv run uvicorn app.main:app --reload

# DB 마이그레이션 (Alembic)
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "add new table"

# 테스트
uv run pytest -v

# 린트 & 포맷
uv run ruff check .
uv run ruff format .
```

### 프론트엔드 (React Native/Expo)
```bash
# 의존성 설치
npm install

# Expo 개발 서버
npx expo start

# iOS 시뮬레이터
npx expo start --ios

# Android 에뮬레이터
npx expo start --android

# 빌드
npx expo build:android
npx expo build:ios

# 린트
npm run lint
```

---

## 7. 중요 노트

### 보안
- `.env` 파일은 `.gitignore`에 포함 (`.env.example`만 커밋)
- API 키, 데이터베이스 암호는 절대 코드에 포함하지 않음
- 민감한 데이터 로깅 금지

### 성능
- **백엔드**: 비동기 처리로 I/O 대기 시간 최소화
- **프론트엔드**: 오프라인 모드로 UI 응답성 향상
- **벡터 DB**: pgvector 임베딩을 활용한 의미론적 검색

### 테스트
- 백엔드: pytest (fixtures, mocking)
- 프론트엔드: Jest, React Testing Library (필요시)

### 모노레포 구조
```
triple-clone/
├── backend/
│   ├── app/
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
├── mobile/
│   ├── app/
│   ├── app.json
│   ├── package.json
│   └── tailwind.config.js
├── docs/
├── .gitignore
└── README.md
```

---

## 8. 체크리스트 (PR 전 확인사항)

- [ ] 모든 함수에 타입 어노테이션 작성
- [ ] routes는 검증만, 비즈니스 로직 없음
- [ ] services는 repositories 호출, 직접 DB 접근 없음
- [ ] 모든 비동기 함수에 `async` 키워드, `await` 사용
- [ ] 환경 변수는 `.env`, 코드에 하드코딩 금지
- [ ] 프론트엔드는 먼저 로컬 DB 읽기, 그 후 동기화
- [ ] 에러 메시지 (로그)에 민감한 정보 없음
- [ ] NativeWind 클래스 우선 (StyleSheet 최소화)
