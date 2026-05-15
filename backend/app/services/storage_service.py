"""Cloudflare R2 (S3 호환) 이미지 업로드 서비스.

R2가 미설정인 경우 NotConfiguredError 발생 → 라우트에서 503 반환.
"""

import io
import logging
import uuid
from typing import BinaryIO

import boto3
from botocore.config import Config
from PIL import Image, ImageOps

from app.config import get_settings

logger = logging.getLogger(__name__)

# R2 업로드 제약
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_DIMENSION = 1600  # 가로 또는 세로의 최대 픽셀


class StorageNotConfiguredError(RuntimeError):
    """R2 환경변수가 미설정일 때."""


class InvalidImageError(ValueError):
    """이미지 검증 실패."""


def _get_client():
    settings = get_settings()
    if not settings.r2_configured:
        raise StorageNotConfiguredError("R2 자격증명이 설정되지 않았습니다.")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4", retries={"max_attempts": 2}),
        region_name="auto",
    )


def _public_url(key: str) -> str:
    settings = get_settings()
    if settings.r2_public_url:
        base = settings.r2_public_url.rstrip("/")
        return f"{base}/{key}"
    # fallback: r2.dev (퍼블릭 access 활성화 시)
    return f"https://pub-{settings.r2_account_id}.r2.dev/{key}"


def process_image(content: bytes, content_type: str) -> tuple[bytes, str, int, int]:
    """이미지 검증 + EXIF 회전 보정 + 리사이즈 + JPEG 변환.

    Returns: (jpeg_bytes, "image/jpeg", width, height)
    """
    if len(content) > MAX_FILE_BYTES:
        raise InvalidImageError(f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_BYTES // 1024 // 1024}MB")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidImageError(f"지원하지 않는 형식: {content_type}")

    try:
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)  # EXIF 회전 보정
        img = img.convert("RGB")
    except Exception as e:
        raise InvalidImageError(f"이미지 파싱 실패: {e}") from e

    # 리사이즈
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    # JPEG 인코딩 (품질 85)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue(), "image/jpeg", img.width, img.height


def upload_photo(stream: BinaryIO, content_type: str, prefix: str = "uploads") -> dict:
    """이미지 업로드 → 처리 → R2 PUT → 퍼블릭 URL 반환.

    Returns: {"url": str, "width": int, "height": int, "key": str}
    """
    raw = stream.read()
    processed, ctype, w, h = process_image(raw, content_type)

    key = f"{prefix}/{uuid.uuid4().hex}.jpg"
    client = _get_client()
    settings = get_settings()
    client.put_object(
        Bucket=settings.r2_bucket,
        Key=key,
        Body=processed,
        ContentType=ctype,
        CacheControl="public, max-age=31536000, immutable",
    )
    url = _public_url(key)
    logger.info("Photo uploaded: key=%s, size=%dx%d", key, w, h)
    return {"url": url, "width": w, "height": h, "key": key}
