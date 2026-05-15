"""글로벌 slowapi Limiter 싱글턴.

routes/* 와 main.py 양쪽에서 임포트할 수 있도록 별도 모듈로 분리
(main.py에서 직접 정의하면 순환 임포트 발생).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
