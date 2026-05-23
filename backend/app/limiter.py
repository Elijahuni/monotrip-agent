"""글로벌 slowapi Limiter 싱글턴.

routes/* 와 main.py 양쪽에서 임포트할 수 있도록 별도 모듈로 분리
(main.py에서 직접 정의하면 순환 임포트 발생).

rate limit 키 전략:
  - 인증된 요청(유효한 Bearer JWT) → "user:{id}" 단위로 제한
  - 비인증 요청 → 클라이언트 IP 단위로 제한

IP 단위만 쓰면 NAT/공유 IP 뒤의 다수 사용자가 서로의 한도를 갉아먹고,
반대로 한 사용자가 IP를 바꿔가며 한도를 우회할 수 있다. 인증된 요청은
user_id로 묶어 사용자별 공정성을 보장한다.
"""

from fastapi import Request
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings


def _user_or_ip_key(request: Request) -> str:
    """유효한 JWT가 있으면 user:{id}, 없으면 IP를 rate limit 키로 사용."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[len("Bearer ") :].strip()
        try:
            settings = get_settings()
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
            sub = payload.get("sub")
            if sub is not None:
                return f"user:{sub}"
        except JWTError:
            # 서명 불일치/만료 등 → IP 폴백 (만료 토큰은 어차피 인증 의존성에서 401)
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_user_or_ip_key, default_limits=["200/minute"])
