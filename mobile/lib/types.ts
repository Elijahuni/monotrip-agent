/** 백엔드 TripSummary 스키마와 1:1 대응 */
export interface Trip {
  id: number;
  user_id: number;
  title: string;
  destination: string | null;   // 목적지 도시/국가명 (항공권·날씨 검색용)
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
  images: string[] | null;
  google_place_id: string | null;
  created_at: string;
  /** 낙관적 동시성 — PATCH 시 If-Match로 전송 */
  version?: number;
  updated_at?: string | null;
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
  images: string[] | null;
  website: string | null;
  phone: string | null;
  estimated_minutes: number | null;
  created_at: string;
}

/** Phase 3: 커뮤니티 */
export interface CommunityPost {
  id: number;
  user_id: number;
  post_type: 'regular' | 'live';
  category: 'qna' | 'review' | 'photospot';
  city: string | null;
  title: string;
  body: string;
  images: string[] | null;
  like_count: number;
  comment_count: number;
  expires_at: string | null;   // live 게시글 만료 시각 (ISO datetime)
  created_at: string;
}

export interface TrendingPost extends CommunityPost {
  nickname: string;
  profile_image_url: string | null;
}

export interface UserStats {
  trip_count: number;
  saved_count: number;
  post_count: number;
  review_count: number;
}

export interface BadgeItem {
  badge_id: string;
  name_ko: string;
  name_en: string;
  description_ko: string;
  emoji: string;
  earned_at: string | null; // ISO string or null if locked
}

export interface Gamification {
  xp: number;
  level: number;
  level_title_ko: string;
  level_title_en: string;
  level_emoji: string;
  xp_current: number;
  xp_required: number;
  xp_percentage: number;
  badges: BadgeItem[];
  locked_badges: BadgeItem[];
}

export interface CommunityComment {
  id: number;
  post_id: number;
  user_id: number;
  body: string;
  created_at: string;
}

/** Phase 2: 메타서치 항공권 결과 */
export interface FlightOffer {
  id: string;
  price_krw: number;
  currency: string;
  airline: string;
  stops: number;
  depart_time: string;       // ISO datetime
  arrive_time: string;
  duration_minutes: number;
  segments: Array<{
    airline: string;
    flight_number: string;
    depart_airport: string;
    arrive_airport: string;
    depart_time: string;
    arrive_time: string;
    duration_minutes: number;
  }>;
  deeplink: string;
  affiliate_source: string;
}

export interface PriceTrend {
  signal: 'buy_now' | 'cheap' | 'average' | 'expensive' | 'insufficient_data';
  message: string;
  current_min: number;
  avg_7d: number | null;
  avg_30d: number | null;
  sample_count_30d: number;
}

export type DataSource = 'live' | 'mock';

export interface FlightSearchResult {
  offers: FlightOffer[];
  providers_succeeded: string[];
  providers_failed: string[];
  trend: PriceTrend | null;
  data_source?: DataSource;
}

/** Phase 2: 메타서치 호텔 결과 */
export interface HotelOffer {
  id: string;
  name: string;
  price_per_night_krw: number;
  total_price_krw: number;
  currency: string;
  rating: number | null;
  review_count: number | null;
  star_rating: number | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  thumbnail: string | null;
  deeplink: string;
  affiliate_source: string;
  women_floor: boolean | null;
  solo_friendly: boolean | null;
}

export interface HotelSearchResult {
  offers: HotelOffer[];
  providers_succeeded: string[];
  providers_failed: string[];
  trend: PriceTrend | null;
  data_source?: DataSource;
}

/** Phase 1-1: 큐레이션 장소 (GET /places/curated) */
export interface CuratedPlace {
  id: number;
  country: string;
  city: string;
  region: string | null;
  name: string;
  name_en: string | null;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  vibe_tags: string[];
  description: string | null;
  cover_image: string | null;
  images: string[] | null;
  instagram_hashtag: string | null;
  website: string | null;
  opening_hours: string | null;
  rating: number | null;
  review_count: number;
  price_level: number | null;
  women_friendly: boolean;
  safety_score: number | null;
  tax_free: boolean;
}

/** 날씨 조건 기반 추천 여행지 (GET /ai/recommend/by-weather) */
export interface WeatherDestination {
  city: string;
  country: string;
  reason: string;
  weather_desc: string;
  sample_locations: string[];
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

// ─── 공지사항 ─────────────────────────────────────────────────────────────────

export type NoticeCategory = 'general' | 'event' | 'maintenance' | 'update';

export interface NoticeListItem {
  id: number;
  category: NoticeCategory;
  title: string;
  is_pinned: boolean;
  published_at: string;
}

export interface NoticeDetail extends NoticeListItem {
  body: string;
}

// ─── 고객센터 FAQ ─────────────────────────────────────────────────────────────

export type FaqCategory = 'general' | 'account' | 'booking' | 'payment' | 'travel' | 'etc';

export interface FaqItem {
  id: number;
  category: FaqCategory;
  question: string;
  answer: string;
}

// ─── 쿠폰 ─────────────────────────────────────────────────────────────────────

export type CouponDiscountType = 'percent' | 'amount';
export type MyCouponStatus = 'available' | 'used' | 'expired';

export interface AvailableCoupon {
  id: number;
  code: string;
  title: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  valid_until: string | null;
  already_claimed: boolean;
}

export interface MyCoupon {
  user_coupon_id: number;
  coupon_id: number;
  code: string;
  title: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  valid_until: string | null;
  status: MyCouponStatus;
  claimed_at: string;
  used_at: string | null;
}
