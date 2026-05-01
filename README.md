# Triple Clone — AI 여행 앱 (Monorepo)

트리플(Triple)과 같은 AI 기반 여행 앱. 모바일 앱(오프라인 우선)과 AI 추천 백엔드(벡터 검색)로 구성된 모노레포.

## Structure

```
triple/
├── mobile/    # Expo + React Native (npm) — 사용자용 모바일 앱
├── backend/   # FastAPI (uv) — REST API + AI 추천 엔진
└── CLAUDE.md  # 개발 규칙 (Claude Code 가이드)
```

## Tech Stack

| Layer    | Stack                                                |
|----------|------------------------------------------------------|
| Mobile   | React Native, Expo Router, TypeScript, NativeWind    |
| Backend  | Python 3.12+, FastAPI, SQLAlchemy 2.x (async)        |
| Database | PostgreSQL 16 + pgvector                             |
| AI       | Google Gemini                                        |

## Quick Start

### Mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```

### Backend (FastAPI)

```bash
cd backend
uv sync
cp .env.example .env  # → 값 채우기
uv run uvicorn app.main:app --reload
# http://localhost:8000/docs
```

## Development Rules

개발 규칙(클린 아키텍처, 비동기 패턴, Local-First, 타입 어노테이션 등)은 [CLAUDE.md](./CLAUDE.md) 참조.
