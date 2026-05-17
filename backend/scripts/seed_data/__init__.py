"""도시별 큐레이션 시드 데이터 모음.

추가된 도시:
  Japan (10): 도쿄·오사카·교토·후쿠오카·삿포로·오키나와·나고야·요코하마·고베·히로시마
  Korea  (8): 서울·부산·제주·강릉·경주·여수·전주 (gangneung, gyeongju, yeosu, jeonju)
  Southeast Asia (6): 방콕·발리·싱가포르·하노이·호치민·쿠알라룸푸르
  Europe  (6): 파리·런던·암스테르담·바르셀로나·로마·프라하
"""
# Japan (existing)
from .tokyo import TOKYO_SEED
from .osaka import OSAKA_SEED
from .kyoto import KYOTO_SEED
# Japan (new)
from .fukuoka import FUKUOKA_SEED
from .sapporo import SAPPORO_SEED
from .okinawa import OKINAWA_SEED
from .nagoya import NAGOYA_SEED
from .yokohama import YOKOHAMA_SEED
from .kobe import KOBE_SEED
from .hiroshima import HIROSHIMA_SEED
# Korea (existing)
from .seoul import SEOUL_SEED
from .busan import BUSAN_SEED
from .jeju import JEJU_SEED
# Korea (new)
from .gangneung import GANGNEUNG_SEED
from .gyeongju import GYEONGJU_SEED
from .yeosu import YEOSU_SEED
from .jeonju import JEONJU_SEED
# Southeast Asia & Europe (new)
from .southeast_asia import SOUTHEAST_ASIA_SEED
from .europe import EUROPE_SEED

ALL_SEEDS = [
    # Japan
    *TOKYO_SEED, *OSAKA_SEED, *KYOTO_SEED,
    *FUKUOKA_SEED, *SAPPORO_SEED, *OKINAWA_SEED,
    *NAGOYA_SEED, *YOKOHAMA_SEED, *KOBE_SEED, *HIROSHIMA_SEED,
    # Korea
    *SEOUL_SEED, *BUSAN_SEED, *JEJU_SEED,
    *GANGNEUNG_SEED, *GYEONGJU_SEED, *YEOSU_SEED, *JEONJU_SEED,
    # Southeast Asia
    *SOUTHEAST_ASIA_SEED,
    # Europe
    *EUROPE_SEED,
]

__all__ = ["ALL_SEEDS"]
