/** 백엔드 TripSummary 스키마와 1:1 대응 */
export interface Trip {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  start_date: string | null;    // "YYYY-MM-DD"
  end_date: string | null;      // "YYYY-MM-DD"
  thumbnail_url: string | null;
  // UP-5: 예산 추적기
  total_budget: number | null;
  group_size: number;
  // UP-7: 공유 링크
  share_token: string | null;
  created_at: string;           // ISO datetime
  updated_at: string;
}

/** 백엔드 LocationResponse 스키마와 1:1 대응 */
export interface Location {
  id: number;
  trip_id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  visit_order: number;
  day_index: number;            // UP-1: Day 1, 2, 3...
  notes: string | null;
  // UP-2: 장소 상세 정보
  phone: string | null;
  opening_hours: string | null;   // JSON 문자열
  estimated_minutes: number | null;
  budget_per_person: number | null;
  website: string | null;
  rating: number | null;
  images: string | null;          // JSON 배열 문자열
  google_place_id: string | null;
  created_at: string;
}

/** AsyncStorage에 캐시할 인증 정보 */
export interface UserCache {
  user_id: number;
  email: string;
  nickname: string;
  access_token: string;
  updated_at: string;
}

/** UP-6: 여행 전 체크리스트 항목 */
export interface ChecklistItem {
  id: number;
  trip_id: number;
  category: string;   // '서류' | '짐' | '예약' | '현금'
  text: string;
  is_checked: boolean;
  created_at: string;
}

/** UP-3: 보관함 — 찜한 장소 */
export interface SavedPlace {
  id: number;
  user_id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  notes: string | null;
  google_place_id: string | null;
  rating: number | null;
  images: string | null;
  website: string | null;
  phone: string | null;
  estimated_minutes: number | null;
  created_at: string;
}

/** AI 추천 여행지 가이드북 */
export interface DestinationGuide {
  destination: string;
  country: string;
  currency: string;
  exchange_rate_krw: number | null;
  timezone: string;
  language: string;
  best_season: string;
  climate_now: string;
  visa: string;
  transport: string[];
  top_areas: { name: string; description: string }[];
  must_eat: string[];
  tips: string[];
}
