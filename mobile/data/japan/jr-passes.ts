/** JR 패스 및 주요 지하철/관광 패스 비교 (정적). */
export interface TransitPass {
  key: string;
  name: string;
  city: string;
  durationDays: number[];        // 가능한 권종 일수
  priceKRW: { days: number; price: number }[];
  coverage: string[];            // 적용 노선·범위
  bestFor: string;               // 추천 시나리오
  notes: string[];               // 주의사항
  officialUrl: string;
}

export const TRANSIT_PASSES: TransitPass[] = [
  {
    key: 'jr-pass',
    name: 'JR 패스 (전국)',
    city: 'japan',
    durationDays: [7, 14, 21],
    priceKRW: [
      { days: 7,  price: 472000 },
      { days: 14, price: 754000 },
      { days: 21, price: 942000 },
    ],
    coverage: ['신칸센 (노조미·미즈호 제외)', 'JR 재래선', 'JR 버스 일부', 'JR 페리 (미야지마)'],
    bestFor: '도쿄·교토·오사카·후쿠오카 등 도시 간 이동 多 (3개 도시 이상)',
    notes: [
      '해외 거주자 단기 체류(관광 비자)만 구매 가능',
      '노조미·미즈호 신칸센은 추가 요금 필요',
      '교환증을 일본 현지 JR 창구에서 실물 패스로 교환',
    ],
    officialUrl: 'https://japanrailpass.net/',
  },
  {
    key: 'tokyo-metro-72h',
    name: '도쿄 메트로 72시간 권',
    city: 'tokyo',
    durationDays: [1, 2, 3],
    priceKRW: [
      { days: 1, price: 8500 },
      { days: 2, price: 13500 },
      { days: 3, price: 16500 },
    ],
    coverage: ['도쿄 메트로 9개 노선', '도에이 지하철 4개 노선'],
    bestFor: '도쿄 시내 위주, 하루 4회 이상 지하철 탑승',
    notes: [
      '외국인 전용. 여권 제시 필수',
      '나리타 익스프레스 / JR 야마노테선 미포함',
      '하네다 공항 관광안내소·주요 호텔에서 구매 가능',
    ],
    officialUrl: 'https://www.tokyometro.jp/tcl/',
  },
  {
    key: 'kansai-thru-pass',
    name: '간사이 스루패스',
    city: 'osaka',
    durationDays: [2, 3],
    priceKRW: [
      { days: 2, price: 50000 },
      { days: 3, price: 62000 },
    ],
    coverage: ['오사카·교토·고베·나라 지하철·버스·사철', 'JR 미포함'],
    bestFor: '간사이 광역 (교토 + 오사카 + 나라 1~2일씩)',
    notes: [
      '연속 사용일이 아닌 임의의 2/3일 선택 가능',
      'JR선은 사용 불가 → 신오사카 ↔ 교토는 한큐/한신 이용',
      '주요 사찰 입장료 할인 쿠폰 포함',
    ],
    officialUrl: 'https://www.surutto.com/tickets/kansai_thru_hantaiyo.html',
  },
  {
    key: 'ic-card',
    name: 'Suica / ICOCA (IC카드)',
    city: 'japan',
    durationDays: [0],
    priceKRW: [{ days: 0, price: 18000 }],
    coverage: ['전국 지하철/버스 (충전식)', '편의점·자판기 결제'],
    bestFor: '단일 도시 중심, 또는 패스 비추인 짧은 일정',
    notes: [
      '보증금 ¥500 + 첫 충전 ¥1,500 = 약 ¥2,000부터',
      '잔액 환불 가능 (수수료 ¥220)',
      '모바일 Suica는 일본 안드로이드·iPhone 모두 지원',
    ],
    officialUrl: 'https://www.jreast.co.jp/multi/ko/pass/suica.html',
  },
];

export function passesForCity(city: string): TransitPass[] {
  return TRANSIT_PASSES.filter((p) => p.city === city || p.city === 'japan');
}
