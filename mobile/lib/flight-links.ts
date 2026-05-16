/**
 * 항공권 검색 딥링크 생성 유틸리티 (Step 3 — 무료, API 키 불필요)
 *
 * 도시명 → IATA 코드 매핑 후 스카이스캐너·카약·네이버 항공 검색 URL 빌드.
 * 출발지: 인천(ICN) 기본값.
 * 실제 가격 조회는 Step 5(Sky Scrapper API)에서 추가 예정.
 */

import { Linking } from 'react-native';

// ─── 도시명 → IATA 코드 ─────────────────────────────────────────────────────

/**
 * 주요 여행 도시의 한/영 표기 + 별칭 → IATA 공항 코드.
 *
 * 설계 원칙:
 * - 정규 도시명(한·영)은 물론, 흔한 오기·별칭·공항명도 포함
 * - 도시가 주 공항 코드(TYO, LON, NYC)를 쓰는 경우엔 메타 코드 사용
 *   → 스카이스캐너는 메타 코드로 "모든 공항" 검색 처리
 */
const CITY_IATA: Record<string, string> = {

  // ── 동아시아 ── Japan ─────────────────────────────────────────────────────
  '도쿄': 'TYO', 'tokyo': 'TYO',
  '도교': 'TYO', 'tokio': 'TYO',                  // 오기 처리
  '나리타': 'NRT', 'narita': 'NRT',                // 공항명 직접 입력
  '하네다': 'HND', 'haneda': 'HND',
  '오사카': 'KIX', 'osaka': 'KIX',
  '오사까': 'KIX', 'ohsaka': 'KIX',               // 오기 처리
  '간사이': 'KIX', 'kansai': 'KIX',
  '교토': 'KIX', 'kyoto': 'KIX',
  '나라': 'KIX', 'nara': 'KIX',                   // 주변 도시 → 오사카 공항
  '삿포로': 'CTS', 'sapporo': 'CTS',
  '홋카이도': 'CTS', 'hokkaido': 'CTS',
  '신치토세': 'CTS', 'chitose': 'CTS',
  '후쿠오카': 'FUK', 'fukuoka': 'FUK',
  '하카타': 'FUK', 'hakata': 'FUK',
  '나가사키': 'NGS', 'nagasaki': 'NGS',
  '구마모토': 'KMJ', 'kumamoto': 'KMJ',
  '나고야': 'NGO', 'nagoya': 'NGO',
  '나하': 'OKA', '오키나와': 'OKA', 'okinawa': 'OKA', 'naha': 'OKA',
  '히로시마': 'HIJ', 'hiroshima': 'HIJ',
  '가고시마': 'KOJ', 'kagoshima': 'KOJ',
  '센다이': 'SDJ', 'sendai': 'SDJ',

  // ── 동아시아 ── China / HK / Macau / Taiwan ────────────────────────────
  '베이징': 'PEK', 'beijing': 'PEK', '북경': 'PEK', 'peking': 'PEK',
  '상하이': 'SHA', 'shanghai': 'SHA', '상해': 'SHA',
  '광저우': 'CAN', 'guangzhou': 'CAN', '광주': 'CAN', 'canton': 'CAN',
  '청두': 'CTU', 'chengdu': 'CTU',
  '충칭': 'CKG', 'chongqing': 'CKG',
  '시안': 'XIY', "xi'an": 'XIY', 'xian': 'XIY',
  '홍콩': 'HKG', 'hong kong': 'HKG', 'hongkong': 'HKG',
  '마카오': 'MFM', 'macau': 'MFM', 'macao': 'MFM',
  '타이베이': 'TPE', 'taipei': 'TPE', '대만': 'TPE', 'taiwan': 'TPE',
  '타이중': 'RMQ', 'taichung': 'RMQ',
  '가오슝': 'KHH', 'kaohsiung': 'KHH',

  // ── 동아시아 ── Mongolia / Russia ─────────────────────────────────────
  '울란바토르': 'ULN', 'ulaanbaatar': 'ULN', 'ulan bator': 'ULN',
  '블라디보스토크': 'VVO', 'vladivostok': 'VVO',

  // ── 동남아 ── Thailand ─────────────────────────────────────────────────
  '방콕': 'BKK', 'bangkok': 'BKK',
  '수완나품': 'BKK', 'suvarnabhumi': 'BKK',
  '돈므앙': 'DMK', 'don mueang': 'DMK', 'dmk': 'DMK',
  '치앙마이': 'CNX', 'chiang mai': 'CNX', 'chiangmai': 'CNX',
  '치앙라이': 'CEI', 'chiang rai': 'CEI',
  '파타야': 'BKK', 'pattaya': 'BKK',
  '푸켓': 'HKT', 'phuket': 'HKT',
  '사무이': 'USM', 'koh samui': 'USM', 'samui': 'USM',
  '끄라비': 'KBV', 'krabi': 'KBV',

  // ── 동남아 ── Vietnam ──────────────────────────────────────────────────
  '하노이': 'HAN', 'hanoi': 'HAN',
  '호치민': 'SGN', 'ho chi minh': 'SGN', 'saigon': 'SGN',
  'ho chi minh city': 'SGN', 'hcmc': 'SGN', '사이공': 'SGN',
  '다낭': 'DAD', 'da nang': 'DAD', 'danang': 'DAD',
  '호이안': 'DAD', 'hoi an': 'DAD',                // 다낭 공항 이용
  '냐짱': 'CXR', 'nha trang': 'CXR',
  '달랏': 'DLI', 'da lat': 'DLI', 'dalat': 'DLI',
  '푸꾸옥': 'PQC', 'phu quoc': 'PQC',

  // ── 동남아 ── Singapore / Malaysia / Indonesia ─────────────────────────
  '싱가포르': 'SIN', 'singapore': 'SIN', 'changi': 'SIN',
  '쿠알라룸푸르': 'KUL', 'kuala lumpur': 'KUL', 'kl': 'KUL',
  '코타키나발루': 'BKI', 'kota kinabalu': 'BKI', 'sabah': 'BKI',
  '랑카위': 'LGK', 'langkawi': 'LGK',
  '페낭': 'PEN', 'penang': 'PEN',
  '발리': 'DPS', 'bali': 'DPS', '덴파사르': 'DPS', 'denpasar': 'DPS',
  '롬복': 'LOP', 'lombok': 'LOP',
  '자카르타': 'CGK', 'jakarta': 'CGK',
  '욕야카르타': 'JOG', 'yogyakarta': 'JOG', 'jogja': 'JOG',

  // ── 동남아 ── Philippines / Myanmar / Cambodia / Laos ──────────────────
  '마닐라': 'MNL', 'manila': 'MNL',
  '세부': 'CEB', 'cebu': 'CEB',
  '보라카이': 'MPH', 'boracay': 'MPH', 'caticlan': 'MPH',
  '팔라완': 'PPS', 'palawan': 'PPS', 'puerto princesa': 'PPS',
  '양곤': 'RGN', 'yangon': 'RGN', '랑군': 'RGN', 'rangoon': 'RGN',
  '프놈펜': 'PNH', 'phnom penh': 'PNH',
  '시엠립': 'REP', 'siem reap': 'REP', '앙코르': 'REP',
  '비엔티안': 'VTE', 'vientiane': 'VTE',
  '루앙프라방': 'LPQ', 'luang prabang': 'LPQ',

  // ── 남아시아 / 중동 ────────────────────────────────────────────────────
  '뭄바이': 'BOM', 'mumbai': 'BOM', '봄베이': 'BOM', 'bombay': 'BOM',
  '델리': 'DEL', 'delhi': 'DEL', '뉴델리': 'DEL', 'new delhi': 'DEL',
  '첸나이': 'MAA', 'chennai': 'MAA', '마드라스': 'MAA', 'madras': 'MAA',
  '콜카타': 'CCU', 'kolkata': 'CCU', '캘커타': 'CCU', 'calcutta': 'CCU',
  '고아': 'GOI', 'goa': 'GOI',
  '카트만두': 'KTM', 'kathmandu': 'KTM', '네팔': 'KTM',
  '두바이': 'DXB', 'dubai': 'DXB',
  '아부다비': 'AUH', 'abu dhabi': 'AUH',
  '도하': 'DOH', 'doha': 'DOH',
  '이스탄불': 'IST', 'istanbul': 'IST', '터키': 'IST', 'turkey': 'IST',
  '텔아비브': 'TLV', 'tel aviv': 'TLV',

  // ── 유럽 ─── UK / France / Iberia ─────────────────────────────────────
  '런던': 'LON', 'london': 'LON',
  '히드로': 'LHR', 'heathrow': 'LHR',
  '파리': 'CDG', 'paris': 'CDG',
  '샤를드골': 'CDG', 'charles de gaulle': 'CDG',
  '바르셀로나': 'BCN', 'barcelona': 'BCN',
  '마드리드': 'MAD', 'madrid': 'MAD',
  '세비야': 'SVQ', 'seville': 'SVQ', 'sevilla': 'SVQ',
  '리스본': 'LIS', 'lisbon': 'LIS', '리스봉': 'LIS',
  '포르투': 'OPO', 'porto': 'OPO', 'oporto': 'OPO',

  // ── 유럽 ─── Italy ─────────────────────────────────────────────────────
  '로마': 'FCO', 'rome': 'FCO', 'roma': 'FCO',
  '밀라노': 'MXP', 'milan': 'MXP', 'milano': 'MXP',
  '베니스': 'VCE', 'venice': 'VCE', 'venezia': 'VCE',
  '피렌체': 'FLR', 'florence': 'FLR', 'firenze': 'FLR',
  '나폴리': 'NAP', 'naples': 'NAP', 'napoli': 'NAP',

  // ── 유럽 ─── Germany / Austria / Switzerland ───────────────────────────
  '프랑크푸르트': 'FRA', 'frankfurt': 'FRA',
  '뮌헨': 'MUC', 'munich': 'MUC', 'münchen': 'MUC',
  '베를린': 'BER', 'berlin': 'BER',
  '함부르크': 'HAM', 'hamburg': 'HAM',
  '취리히': 'ZRH', 'zurich': 'ZRH', 'zürich': 'ZRH',
  '제네바': 'GVA', 'geneva': 'GVA',
  '비엔나': 'VIE', 'vienna': 'VIE', 'wien': 'VIE',

  // ── 유럽 ─── Benelux / Scandinavia / Eastern Europe ───────────────────
  '암스테르담': 'AMS', 'amsterdam': 'AMS',
  '브뤼셀': 'BRU', 'brussels': 'BRU', 'bruxelles': 'BRU',
  '코펜하겐': 'CPH', 'copenhagen': 'CPH',
  '스톡홀름': 'ARN', 'stockholm': 'ARN',
  '오슬로': 'OSL', 'oslo': 'OSL',
  '헬싱키': 'HEL', 'helsinki': 'HEL',
  '더블린': 'DUB', 'dublin': 'DUB',
  '프라하': 'PRG', 'prague': 'PRG', 'praha': 'PRG',
  '부다페스트': 'BUD', 'budapest': 'BUD',
  '바르샤바': 'WAW', 'warsaw': 'WAW', 'warszawa': 'WAW',
  '아테네': 'ATH', 'athens': 'ATH',
  '크로아티아': 'ZAG', 'zagreb': 'ZAG',
  '두브로브니크': 'DBV', 'dubrovnik': 'DBV',
  '부쿠레슈티': 'OTP', 'bucharest': 'OTP',
  '소피아': 'SOF', 'sofia': 'SOF',

  // ── 미주 ─────────────────────────────────────────────────────────────
  '뉴욕': 'NYC', 'new york': 'NYC', 'ny': 'NYC', 'nyc': 'NYC',
  '로스앤젤레스': 'LAX', 'los angeles': 'LAX',
  '시카고': 'CHI', 'chicago': 'CHI',
  '샌프란시스코': 'SFO', 'san francisco': 'SFO', 'sf': 'SFO',
  '라스베가스': 'LAS', 'las vegas': 'LAS', 'vegas': 'LAS',
  '시애틀': 'SEA', 'seattle': 'SEA',
  '보스턴': 'BOS', 'boston': 'BOS',
  '마이애미': 'MIA', 'miami': 'MIA',
  '워싱턴': 'WAS', 'washington': 'WAS', 'washington dc': 'WAS', 'dc': 'WAS',
  '달라스': 'DFW', 'dallas': 'DFW',
  '휴스턴': 'IAH', 'houston': 'IAH',
  '덴버': 'DEN', 'denver': 'DEN',
  '샌디에고': 'SAN', 'san diego': 'SAN',
  '포틀랜드': 'PDX', 'portland': 'PDX',
  '하와이': 'HNL', 'hawaii': 'HNL', '호놀룰루': 'HNL', 'honolulu': 'HNL',
  '밴쿠버': 'YVR', 'vancouver': 'YVR',
  '토론토': 'YYZ', 'toronto': 'YYZ',
  '몬트리올': 'YUL', 'montreal': 'YUL', 'montréal': 'YUL',
  '멕시코시티': 'MEX', 'mexico city': 'MEX',
  '칸쿤': 'CUN', 'cancun': 'CUN', 'cancún': 'CUN',

  // ── 중남미 ────────────────────────────────────────────────────────────
  '상파울루': 'GRU', 'sao paulo': 'GRU', 'são paulo': 'GRU',
  '리우데자네이루': 'GIG', 'rio de janeiro': 'GIG', 'rio': 'GIG',
  '부에노스아이레스': 'EZE', 'buenos aires': 'EZE',
  '리마': 'LIM', 'lima': 'LIM',
  '보고타': 'BOG', 'bogota': 'BOG', 'bogotá': 'BOG',

  // ── 오세아니아 ───────────────────────────────────────────────────────
  '시드니': 'SYD', 'sydney': 'SYD',
  '멜버른': 'MEL', 'melbourne': 'MEL',
  '브리즈번': 'BNE', 'brisbane': 'BNE',
  '퍼스': 'PER', 'perth': 'PER',
  '오클랜드': 'AKL', 'auckland': 'AKL',
  '크라이스트처치': 'CHC', 'christchurch': 'CHC',
  '퀸스타운': 'ZQN', 'queenstown': 'ZQN',

  // ── 아프리카 ─────────────────────────────────────────────────────────
  '카이로': 'CAI', 'cairo': 'CAI',
  '케이프타운': 'CPT', 'cape town': 'CPT',
  '요하네스버그': 'JNB', 'johannesburg': 'JNB',
  '나이로비': 'NBO', 'nairobi': 'NBO',
  '마라케시': 'RAK', 'marrakech': 'RAK', 'marrakesh': 'RAK',
  '카사블랑카': 'CMN', 'casablanca': 'CMN',
};

/** 유효한 3-letter IATA 코드인지 확인 (대문자 알파벳 3자) */
const IATA_RE = /^[A-Z]{3}$/;

/**
 * 부분 매칭용으로 매핑 키를 길이 내림차순 정렬 (최장 매칭 우선).
 * 모듈 로드 시 1회만 계산.
 */
const SORTED_KEYS = Object.keys(CITY_IATA).sort((a, b) => b.length - a.length);

/**
 * 도시명(한/영) → IATA 코드 조회.
 *
 * 우선순위:
 * 1. 입력이 이미 3자리 대문자 IATA 코드면 그대로 반환
 * 2. 정규화(소문자·trim) 후 테이블 완전 일치
 * 3. 매핑 키가 입력에 포함(최장 키 우선) — "도쿄 3일", "오사카 자유여행"
 * 4. 없으면 null
 */
export function resolveIata(city: string): string | null {
  const raw = city.trim();

  // 1. 이미 IATA 코드 (예: "TYO", "NRT")
  if (IATA_RE.test(raw.toUpperCase())) {
    return raw.toUpperCase();
  }

  const key = raw.toLowerCase();

  // 2. 정확 일치
  if (CITY_IATA[key]) return CITY_IATA[key];

  // 3. 매핑 키가 입력 문자열에 포함 — "도쿄 3일" → '도쿄' 매칭
  for (const k of SORTED_KEYS) {
    if (key.includes(k)) return CITY_IATA[k]!;
  }

  return null;
}

// ─── URL 빌더 ─────────────────────────────────────────────────────────────────

export interface FlightLinks {
  skyscanner: string;
  kayak:      string;
  naver:      string;
  /** 목적지 IATA. null이면 URL이 fallback 검색 */
  iata:       string | null;
}

/**
 * 인천(ICN) 출발 → 목적지 항공권 검색 링크 빌드.
 * @param destination 도시명 (한/영)
 * @param departDate  "YYYY-MM-DD" 형식 출발일 (없으면 날짜 없는 링크)
 */
export function buildFlightLinks(destination: string, departDate?: string): FlightLinks {
  const iata = resolveIata(destination);
  const encodedDest = encodeURIComponent(destination);

  // 날짜 포맷
  // 스카이스캐너: YYMMDD (e.g. 250610)
  // 카약: YYYY-MM-DD
  // 네이버 항공: YYYYMMDD
  let skyDate = 'anytime';
  let kayakDate = '';
  let naverDate = '';
  if (departDate) {
    const d = departDate.replace(/-/g, '');            // YYYYMMDD
    skyDate  = d.slice(2);                             // YYMMDD
    kayakDate = departDate;                            // YYYY-MM-DD
    naverDate = d;                                     // YYYYMMDD
  }

  const skyscanner = iata
    ? `https://www.skyscanner.co.kr/transport/flights/ICN/${iata}/${skyDate}/`
    : `https://www.skyscanner.co.kr/transport/flights/ICN/?query=${encodedDest}`;

  const kayak = iata && kayakDate
    ? `https://www.kayak.co.kr/flights/ICN-${iata}/${kayakDate}`
    : `https://www.kayak.co.kr/flights/ICN-${iata ?? encodedDest}`;

  const naver = iata
    ? `https://flight.naver.com/flights/international/ICN-${iata}-${naverDate || 'anytime'}`
    : `https://flight.naver.com/flights/international?destination=${encodedDest}`;

  return { skyscanner, kayak, naver, iata };
}

// ─── 원클릭 오픈 헬퍼 ─────────────────────────────────────────────────────────

/**
 * 항공권 검색 URL을 스카이스캐너 → 네이버 항공 순으로 첫 번째 열 수 있는 링크로 오픈.
 */
export async function openFlightSearch(destination: string, departDate?: string): Promise<void> {
  const links = buildFlightLinks(destination, departDate);
  const url = links.skyscanner;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    // Skyscanner 불가 시 네이버 항공으로 fallback
    await Linking.openURL(links.naver);
  }
}
