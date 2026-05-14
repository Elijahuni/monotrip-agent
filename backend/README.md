# Triple Clone — Backend (FastAPI)

Python 3.12+ / FastAPI / SQLAlchemy 2.x (async) / PostgreSQL 16 + pgvector

## Quick Start

```bash
# 1. 의존성 동기화 (.venv 자동 생성)
uv sync

# 2. 환경 변수 설정
cp .env.example .env
# → .env 파일을 열어 DATABASE_URL, GEMINI_API_KEY 등 채우기

# 3. 개발 서버 실행
uv run uvicorn app.main:app --reload

# 4. 헬스체크
curl http://localhost:8000/health
# → {"status": "ok"}

# 5. Swagger UI
open http://localhost:8000/docs
```

## Architecture

클린 아키텍처 4계층 분리:

```
app/
├── main.py           # FastAPI 앱 entry
├── routes/           # HTTP 요청/응답 (Pydantic 검증)
├── services/         # 비즈니스 로직, AI 호출
├── repositories/     # DB 접근 (SQLAlchemy)
└── models/           # DB 테이블 스키마
```

세부 규칙은 루트 [`CLAUDE.md`](../CLAUDE.md) 참조.

## Common Commands

```bash
uv sync                              # 의존성 동기화
uv add <package>                     # 패키지 추가
uv add --dev <package>               # 개발 의존성 추가
uv run uvicorn app.main:app --reload # 서버 실행
uv run pytest                        # 테스트
uv run ruff check .                  # 린트
uv run ruff format .                 # 포맷
```
