"""시드 데이터 헬퍼."""


def unsplash(photo_id: str, width: int = 800) -> str:
    """Unsplash 플레이스홀더 URL 생성. 실제 운영 전 자체 CDN으로 교체."""
    return f"https://images.unsplash.com/{photo_id}?w={width}"
