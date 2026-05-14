/** 백엔드 TripSummary 스키마와 1:1 대응 */
export interface Trip {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  start_date: string | null;   // "YYYY-MM-DD"
  end_date: string | null;     // "YYYY-MM-DD"
  thumbnail_url: string | null;
  created_at: string;          // ISO datetime
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
  notes: string | null;
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
