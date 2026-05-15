# syntax=docker/dockerfile:1.7

# ── Builder ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 의존성 먼저 (캐시 최적화)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 앱 소스 복사 후 프로젝트 설치
COPY . .
RUN uv sync --frozen --no-dev

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# 시스템 라이브러리 (Pillow JPEG 처리)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production

EXPOSE 8000

# 배포 시 마이그레이션 자동 적용
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
