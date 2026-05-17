/** 한국 교통 패스 & 카드 (일본인 관광객 관점, 한국어 안내). */

export interface KoreanTransitPass {
  key: string;
  name: string;
  city: string;
  durationDays: number[];
  priceKRW: { days: number; price: number }[];
  coverage: string[];
  bestFor: string;
  notes: string[];
  officialUrl: string;
}

export const KOREA_TRANSIT_PASSES: KoreanTransitPass[] = [
  {
    key: 'tmoney',
    name: '티머니 카드 (T-money)',
    city: 'korea',
    durationDays: [0],
    priceKRW: [{ days: 0, price: 4000 }],
    coverage: [
      '전국 지하철·시내버스·마을버스',
      '택시(일부)·고속버스·KTX(역사 내 매장)',
      '편의점·자판기·코인 로커 결제',
    ],
    bestFor: '한국 여행 필수. 일본의 Suica/ICOCA에 해당',
    notes: [
      '편의점(GS25/CU/세븐일레븐)에서 4,000원에 구매',
      '충전은 1,000원 단위, 잔액 환불 가능 (수수료 500원)',
      '인천공항 1터미널 지하 1층에서도 구매 가능',
    ],
    officialUrl: 'https://www.t-money.co.kr/',
  },
  {
    key: 'k-tourist-pass',
    name: '한국 관광 패스 (Korea Tour Card)',
    city: 'korea',
    durationDays: [0],
    priceKRW: [{ days: 0, price: 5000 }],
    coverage: [
      '티머니 기능 + 외국인 관광객 전용 할인',
      '롯데월드·N서울타워·면세점·뷰티 매장 할인',
      'K-POP 공연·한복 체험 할인 쿠폰',
    ],
    bestFor: '관광 + 쇼핑 위주 일정. 외국인만 구매 가능',
    notes: [
      '인천공항·김포공항·명동 관광안내소에서 구매',
      '카드값 5,000원에 첫 충전은 별도',
      '여권 제시 필수 (외국인 전용)',
    ],
    officialUrl: 'https://en.koreatourcard.kr/',
  },
  {
    key: 'seoul-discover-pass',
    name: '서울 디스커버 패스 (Discover Seoul Pass)',
    city: 'seoul',
    durationDays: [1, 2, 3, 5],
    priceKRW: [
      { days: 1, price: 50000 },
      { days: 2, price: 70000 },
      { days: 3, price: 90000 },
      { days: 5, price: 120000 },
    ],
    coverage: [
      '경복궁·창덕궁·N서울타워 등 주요 관광지 100여 곳 무료',
      '공항철도 직통열차 1회 포함 (3일권 이상)',
      '면세점·뷰티·식당 할인',
    ],
    bestFor: '서울 관광 명소 3곳 이상 방문 예정',
    notes: [
      '명동·홍대·강남 관광안내소·온라인 구매 가능',
      '교통카드(티머니) 기능 포함, 별도 충전 가능',
      '모바일 앱 버전(Discover Seoul Pass App)도 있음',
    ],
    officialUrl: 'https://www.discoverseoulpass.com/',
  },
  {
    key: 'ktx',
    name: 'KTX (고속철도)',
    city: 'korea',
    durationDays: [0],
    priceKRW: [
      { days: 0, price: 59800 },  // 서울→부산 일반석 기준
    ],
    coverage: [
      '서울 ↔ 부산 약 2시간 30분',
      '서울 ↔ 광주·여수·강릉',
      '인천공항 → 서울역 직통(공항철도)도 KTX 환승 가능',
    ],
    bestFor: '서울 + 부산/강릉/광주 멀티 도시 일정',
    notes: [
      'KORAIL 외국인 패스(KR Pass): 연속 2/3/5일권 ₩137,000~',
      '인터넷·앱 사전 예매 권장 (주말은 매진 빈번)',
      '신용카드·해외 결제 가능. 일본어 안내 충실',
    ],
    officialUrl: 'https://www.letskorail.com/',
  },
  {
    key: 'incheon-airport-bus',
    name: '인천공항 리무진/AREX',
    city: 'seoul',
    durationDays: [0],
    priceKRW: [
      { days: 0, price: 9500 },  // 공항 리무진 기준
    ],
    coverage: [
      '리무진 버스: 서울 시내 주요 호텔·역까지 직행',
      'AREX 직통열차: 인천공항 ↔ 서울역 43분',
      'AREX 일반열차: 모든 역 정차 (저렴)',
    ],
    bestFor: '캐리어 多·호텔 근처 정류장 있을 때(리무진) / 빠른 이동(AREX 직통)',
    notes: [
      'AREX 직통: ₩11,000 / 일반: ₩4,250 (티머니 가능)',
      '리무진은 노선·시간대별 가격 상이',
      '심야 도착(00:00~05:00)은 공항버스가 거의 없음 → 택시 추천',
    ],
    officialUrl: 'https://www.arex.or.kr/',
  },
];

export function passesForKoreanCity(city: string): KoreanTransitPass[] {
  return KOREA_TRANSIT_PASSES.filter((p) => p.city === city || p.city === 'korea');
}
