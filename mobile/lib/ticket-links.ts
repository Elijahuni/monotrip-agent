/**
 * 관광지·액티비티 티켓 딥링크 생성 유틸리티 (Step 4 — 무료, API 키 불필요)
 *
 * 장소명 + 목적지 → Klook·KKday·마이리얼트립·Viator 검색 URL 빌드.
 * 실제 가격 조회는 Step 6(Viator/Klook 제휴 API)에서 추가 예정.
 */

import { Linking } from 'react-native';

// ─── URL 빌더 ─────────────────────────────────────────────────────────────────

export interface TicketLinks {
  klook:       string;
  kkday:       string;
  myrealtrip:  string;
  viator:      string;
}

/**
 * 관광지 티켓 검색 링크 빌드.
 * @param placeName   장소명 (예: "센소지 사원")
 * @param destination 도시명 (예: "도쿄") — 검색 정확도 향상
 */
export function buildTicketLinks(placeName: string, destination: string): TicketLinks {
  const query = `${placeName} ${destination}`.trim();
  const encodedQuery = encodeURIComponent(query);
  const encodedPlace = encodeURIComponent(placeName);
  const encodedDest  = encodeURIComponent(destination);

  return {
    klook: `https://www.klook.com/ko/search/?query=${encodedQuery}`,
    kkday: `https://www.kkday.com/ko-kr/product-list/?keyword=${encodedQuery}`,
    myrealtrip: `https://www.myrealtrip.com/offers?query=${encodedQuery}`,
    viator: `https://www.viator.com/en-KR/search?text=${encodedPlace}&destination=${encodedDest}`,
  };
}

// ─── 카테고리 감지 ────────────────────────────────────────────────────────────

/** 티켓 검색 버튼을 표시할 카테고리 목록 */
const TICKET_CATEGORIES = new Set(['관광지', '액티비티', '문화', '엔터테인먼트']);

export function isTicketable(category: string): boolean {
  return TICKET_CATEGORIES.has(category);
}

// ─── 원클릭 오픈 헬퍼 ────────────────────────────────────────────────────────

/**
 * 관광지 티켓 검색 URL을 Klook 우선으로 열기.
 * Klook 앱이 없으면 웹 브라우저에서 열림.
 */
export async function openTicketSearch(placeName: string, destination: string): Promise<void> {
  const links = buildTicketLinks(placeName, destination);
  // Klook 우선 → 마이리얼트립 fallback (한국어 지원)
  try {
    const supported = await Linking.canOpenURL(links.klook);
    await Linking.openURL(supported ? links.klook : links.myrealtrip);
  } catch {
    await Linking.openURL(links.myrealtrip);
  }
}
