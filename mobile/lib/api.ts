import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// allow _retry flag on request config without TypeScript complaints
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

import {
  aiTripPlanSchema,
  locationSchema,
  placeSearchResponseSchema,
  safeParse,
  tokenSchema,
  tripDetailSchema,
  tripSchema,
  userSchema,
  type PlaceSearchResult,
} from '@/lib/schemas';
import type { AvailableCoupon, BadgeItem, ChecklistItem, CommunityComment, CommunityPost, CuratedPlace, DestinationGuide, DmConversation, DmMessage, FaqItem, FlightSearchResult, Gamification, HotelSearchResult, Location, MyCoupon, NoticeDetail, NoticeListItem, OfflineGuideDetail, OfflineGuideListItem, RentalCarSearchResult, SavedPlace, TourSearchResult, Trip, TrendingPost, UserCache, UserStats, WeatherDestination } from '@/lib/types';
import { z } from 'zod';

// ─── 환경 변수 ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// SecureStore 키 — 영숫자/./-/_ 만 허용되므로 AsyncStorage 시절의 '@triple/...' 키와 다름.
const SECURE_TOKEN_KEY = 'triple_access_token';
const SECURE_REFRESH_KEY = 'triple_refresh_token';

// 구버전(AsyncStorage 평문 저장) 키 — 1회 마이그레이션 후 제거.
const LEGACY_TOKEN_KEY = '@triple/access_token';
const LEGACY_REFRESH_KEY = '@triple/refresh_token';

// SecureStore는 웹에서 사용 불가 → 웹에서는 AsyncStorage로 폴백.
const useSecure = Platform.OS !== 'web';

async function secureSet(key: string, value: string): Promise<void> {
  if (useSecure) await SecureStore.setItemAsync(key, value);
  else await AsyncStorage.setItem(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (useSecure) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

async function secureDelete(key: string): Promise<void> {
  if (useSecure) await SecureStore.deleteItemAsync(key);
  else await AsyncStorage.removeItem(key);
}

// ─── 공용 응답 타입 ────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ─── 요청/응답 타입 ────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: number;
  email: string;
  nickname: string;
  profile_image_url: string | null;
  created_at: string;
}

export interface TripLocationCreateRequest {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  visit_order: number;
  notes?: string | null;
}

export interface TripCreateRequest {
  title: string;
  destination?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  thumbnail_url?: string | null;
  total_budget?: number | null;
  group_size?: number;
  /** AI 빌더 등에서 trip + locations를 한 번에 생성할 때 사용 */
  locations?: TripLocationCreateRequest[];
}

export interface TripDetail extends Trip {
  locations: Location[];
}

/** 백엔드 TripPage 응답 타입 */
export interface TripPage {
  items: Trip[];
  next_cursor: number | null;
  has_more: boolean;
}

// ─── Axios 인스턴스 ───────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: AsyncStorage에서 토큰을 읽어 Authorization 헤더 주입
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터:
// - 401: refresh token으로 갱신 시도 → 성공 시 원본 요청 재시도, 실패 시 logout.
//   /auth/* 엔드포인트(로그인 실패 등)나 이미 재시도한 요청은 즉시 reject.
// - 429: 사용자에게 토스트 안내.
// store ← api 순환 import를 피하기 위해 dynamic import 사용.
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    // logout 도 제외 — 만료 토큰으로 로그아웃 시 401 → refresh 실패 → logout() 재호출
    // → 다시 /auth/logout 401 … 무한 루프를 끊는다. (로그아웃은 401이어도 로컬 정리만 하면 됨)
    const isAuthEndpoint = /\/auth\/(login|register|refresh|logout)/.test(url);

    if (status === 401 && !isAuthEndpoint && !error.config?._retry) {
      const refreshToken = await getStoredRefreshToken();
      if (refreshToken) {
        try {
          // 별도 axios 인스턴스로 호출 — 인터셉터 재진입 방지
          const res = await axios.post<ApiResponse<TokenResponse>>(
            `${BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { 'Content-Type': 'application/json' } },
          );
          const newTokens = res.data.data;
          await saveToken(newTokens.access_token, newTokens.refresh_token);

          if (error.config) {
            error.config._retry = true;
            error.config.headers.Authorization = `Bearer ${newTokens.access_token}`;
            return client(error.config);
          }
        } catch {
          // refresh 실패 — 아래 logout 경로로 진행
        }
      }

      // refresh token 없거나 갱신 실패 → 로그아웃
      try {
        const { useAuthStore } = await import('@/store');
        await useAuthStore.getState().logout();
      } catch {
        await clearToken();
      }
    }

    // 429 Rate limit → 사용자에게 토스트 안내
    if (status === 429) {
      try {
        const Toast = (await import('react-native-toast-message')).default;
        Toast.show({
          type: 'error',
          text1: '잠시 후 다시 시도해 주세요',
          text2: '요청이 너무 많습니다. 1분 후 다시 시도하세요.',
          visibilityTime: 4000,
          position: 'bottom',
        });
      } catch { /* ignore */ }
    }

    return Promise.reject(error);
  },
);

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/**
 * 응답 unwrap + Zod 검증 헬퍼.
 * 백엔드 응답이 스키마와 다르면 __DEV__ 콘솔 경고 + 원본 값 통과.
 */
function parseResp<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  return safeParse(schema, raw, label);
}

export const api = {
  auth: {
    async register(body: RegisterRequest): Promise<UserResponse> {
      const res = await client.post<ApiResponse<UserResponse>>('/auth/register', body);
      return parseResp(userSchema, res.data.data, 'auth.register');
    },

    async login(body: LoginRequest): Promise<TokenResponse> {
      const res = await client.post<ApiResponse<TokenResponse>>('/auth/login', body);
      return parseResp(tokenSchema, res.data.data, 'auth.login');
    },

    async me(): Promise<UserResponse> {
      const res = await client.get<ApiResponse<UserResponse>>('/auth/me');
      return parseResp(userSchema, res.data.data, 'auth.me');
    },

    async logout(): Promise<void> {
      await client.post('/auth/logout');
    },

    /** 카카오 OAuth: 모바일 카카오 SDK 또는 WebView로 받은 access_token/code 전달 */
    async kakao(body: { access_token?: string; code?: string }): Promise<TokenResponse> {
      const res = await client.post<ApiResponse<TokenResponse>>('/auth/kakao', body);
      return parseResp(tokenSchema, res.data.data, 'auth.kakao');
    },
    async google(body: { id_token: string }): Promise<TokenResponse> {
      const res = await client.post<ApiResponse<TokenResponse>>('/auth/google', body);
      return parseResp(tokenSchema, res.data.data, 'auth.google');
    },
    async apple(body: { identity_token: string; full_name?: string | null }): Promise<TokenResponse> {
      const res = await client.post<ApiResponse<TokenResponse>>('/auth/apple', body);
      return parseResp(tokenSchema, res.data.data, 'auth.apple');
    },
  },

  trips: {
    /** cursor 기반 페이지네이션. cursor가 없으면 첫 페이지. */
    async getAll(params?: { limit?: number; cursor?: number }): Promise<TripPage> {
      const res = await client.get<ApiResponse<TripPage>>('/trips', { params });
      const raw = res.data.data;
      return {
        items: parseResp(z.array(tripSchema), raw.items, 'trips.getAll.items'),
        next_cursor: raw.next_cursor ?? null,
        has_more: raw.has_more ?? false,
      };
    },

    async getOne(tripId: number): Promise<TripDetail> {
      const res = await client.get<ApiResponse<TripDetail>>(`/trips/${tripId}`);
      return parseResp(tripDetailSchema, res.data.data, 'trips.getOne');
    },

    async create(body: TripCreateRequest): Promise<TripDetail> {
      const res = await client.post<ApiResponse<TripDetail>>('/trips', body);
      return parseResp(tripDetailSchema, res.data.data, 'trips.create');
    },

    async update(tripId: number, body: Partial<TripCreateRequest>): Promise<TripDetail> {
      const res = await client.patch<ApiResponse<TripDetail>>(`/trips/${tripId}`, body);
      return parseResp(tripDetailSchema, res.data.data, 'trips.update');
    },

    async remove(tripId: number): Promise<void> {
      await client.delete(`/trips/${tripId}`);
    },

    async duplicate(tripId: number): Promise<TripDetail> {
      const res = await client.post<ApiResponse<TripDetail>>(`/trips/${tripId}/duplicate`);
      return parseResp(tripDetailSchema, res.data.data, 'trips.duplicate');
    },
  },

  locations: {
    async create(
      tripId: number,
      body: {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        category: string;
        visit_order: number;
        notes?: string | null;
      },
    ): Promise<Location> {
      const res = await client.post<ApiResponse<Location>>(`/trips/${tripId}/locations`, body);
      return parseResp(locationSchema, res.data.data, 'locations.create');
    },

    async update(
      tripId: number,
      locationId: number,
      body: Partial<Location>,
      opts?: { expectedVersion?: number },
    ): Promise<Location> {
      const headers: Record<string, string> = {};
      if (opts?.expectedVersion !== undefined) {
        headers['If-Match'] = String(opts.expectedVersion);
      }
      const res = await client.patch<ApiResponse<Location>>(
        `/trips/${tripId}/locations/${locationId}`,
        body,
        { headers },
      );
      return parseResp(locationSchema, res.data.data, 'locations.update');
    },

    async remove(tripId: number, locationId: number): Promise<void> {
      await client.delete(`/trips/${tripId}/locations/${locationId}`);
    },
  },

  ai: {
    async recommend(params: {
      destination: string;
      days: number;
      preferences?: string;
      travel_style?: string;
      /** wttr.in 현재 기온 (°C) */
      weather_temp_c?: number;
      /** wttr.in weatherCode (비/눈 감지) */
      weather_code?: number;
      /** 강우 확률 (0~100) */
      rain_chance?: number;
    }): Promise<{ title: string; description: string; locations: Location[] }> {
      // AI 생성은 Gemini 응답 시간이 길 수 있으므로 전용 timeout 60초 사용
      const res = await client.get('/ai/recommend', {
        params: { ...params, travel_style: params.travel_style },
        timeout: 60_000,
      });
      return parseResp(aiTripPlanSchema, res.data.data, 'ai.recommend') as {
        title: string;
        description: string;
        locations: Location[];
      };
    },
    /** 여행지 가이드 (통화·시간대·비자·교통·음식·꿀팁). 24h SQLite 캐싱 권장. */
    async destinationGuide(destination: string): Promise<DestinationGuide> {
      const res = await client.get<ApiResponse<DestinationGuide>>('/ai/destination-guide', {
        params: { destination },
        timeout: 60_000, // 가이드 생성도 시간이 걸릴 수 있음
      });
      return res.data.data;
    },

    /**
     * 날씨 조건으로 세계 여행지 3곳 추천.
     * @param weather_condition "sunny_warm" | "spring" | "snow" | "cool" | "hot_summer"
     */
    async byWeather(weather_condition: string): Promise<WeatherDestination[]> {
      const res = await client.get<ApiResponse<{ destinations: WeatherDestination[] }>>(
        '/ai/recommend/by-weather',
        { params: { weather_condition }, timeout: 60_000 },
      );
      return res.data.data.destinations ?? [];
    },

    /** 부분 재생성 — 유지할 장소 + 피드백을 보내 나머지를 새로 받는다. */
    async refine(body: {
      destination: string;
      days: number;
      keep_locations: Array<{
        name: string;
        address: string;
        latitude: number;
        longitude: number;
        category: string;
        visit_order: number;
        notes: string | null;
      }>;
      feedback: string;
      target_total?: number;
    }): Promise<{ title: string; description: string; locations: Location[] }> {
      const res = await client.post('/ai/recommend/refine', body, { timeout: 60_000 });
      return parseResp(aiTripPlanSchema, res.data.data, 'ai.refine') as {
        title: string;
        description: string;
        locations: Location[];
      };
    },
  },

  places: {
    /**
     * 텍스트로 장소 검색. lat/lng가 있으면 결과를 그 근방으로 편향.
     */
    async search(params: {
      query: string;
      lat?: number;
      lng?: number;
      language?: string;
    }): Promise<PlaceSearchResult[]> {
      const res = await client.get('/places/search', {
        params: {
          query: params.query,
          lat: params.lat,
          lng: params.lng,
          language: params.language ?? 'ko',
        },
      });
      const parsed = parseResp(placeSearchResponseSchema, res.data.data, 'places.search');
      return parsed.results;
    },

    /**
     * Phase 1-1: 큐레이션 장소 목록.
     * city는 한글("도쿄") 또는 키("tokyo") 모두 가능.
     * vibes는 반복 파라미터로 직렬화 — axios가 paramsSerializer 없이도 배열을 지원.
     */
    async curated(params: {
      city: string;
      category?: string;
      vibes?: string[];
      women_friendly?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<CuratedPlace[]> {
      const res = await client.get<ApiResponse<CuratedPlace[]>>('/places/curated', {
        params,
        // 배열을 ?vibes=a&vibes=b 형태로 직렬화 (FastAPI 기본 파서 호환)
        paramsSerializer: { indexes: null },
      });
      return res.data.data ?? [];
    },

    async curatedDetail(placeId: number): Promise<CuratedPlace> {
      const res = await client.get<ApiResponse<CuratedPlace>>(`/places/curated/${placeId}`);
      return res.data.data;
    },

    async curatedSimilar(placeId: number, limit = 6): Promise<CuratedPlace[]> {
      const res = await client.get<ApiResponse<CuratedPlace[]>>(
        `/places/curated/${placeId}/similar`,
        { params: { limit } },
      );
      return res.data.data ?? [];
    },

    async curatedAddToTrip(
      placeId: number,
      body: { trip_id: number; day_index: number; visit_order: number },
    ): Promise<Location> {
      const res = await client.post<ApiResponse<Location>>(
        `/places/curated/${placeId}/add-to-trip`,
        body,
      );
      return res.data.data;
    },
  },

  // ─── UP-6: 체크리스트 ────────────────────────────────────────────────────────
  checklist: {
    async getAll(tripId: number): Promise<ChecklistItem[]> {
      const res = await client.get<ApiResponse<ChecklistItem[]>>(`/trips/${tripId}/checklist`);
      return res.data.data ?? [];
    },
    async add(tripId: number, body: { category: string; text: string }): Promise<ChecklistItem> {
      const res = await client.post<ApiResponse<ChecklistItem>>(`/trips/${tripId}/checklist`, body);
      return res.data.data;
    },
    async toggle(tripId: number, itemId: number, is_checked: boolean): Promise<ChecklistItem> {
      const res = await client.patch<ApiResponse<ChecklistItem>>(
        `/trips/${tripId}/checklist/${itemId}`,
        { is_checked },
      );
      return res.data.data;
    },
    async remove(tripId: number, itemId: number): Promise<void> {
      await client.delete(`/trips/${tripId}/checklist/${itemId}`);
    },
  },

  // ─── UP-3: 보관함 (찜한 장소) ────────────────────────────────────────────────
  saved_places: {
    async getAll(): Promise<SavedPlace[]> {
      const res = await client.get<ApiResponse<SavedPlace[]>>('/saved-places');
      return res.data.data ?? [];
    },
    async save(body: Omit<SavedPlace, 'id' | 'user_id' | 'created_at'>): Promise<SavedPlace> {
      const res = await client.post<ApiResponse<SavedPlace>>('/saved-places', body);
      return res.data.data;
    },
    async remove(savedPlaceId: number): Promise<void> {
      await client.delete(`/saved-places/${savedPlaceId}`);
    },
    async addToTrip(
      savedPlaceId: number,
      body: { trip_id: number; day_index: number; visit_order: number },
    ): Promise<Location> {
      const res = await client.post<ApiResponse<Location>>(
        `/saved-places/${savedPlaceId}/add-to-trip`,
        body,
      );
      return res.data.data;
    },
  },

  // ─── UP-9: 사진 업로드 ─────────────────────────────────────────────────────────
  uploads: {
    /**
     * 로컬 파일 URI(예: file:///…/IMG_1234.jpg)를 백엔드에 멀티파트로 업로드.
     * 응답: { url, width, height, key }
     */
    async photo(uri: string): Promise<{ url: string; width: number; height: number; key: string }> {
      const form = new FormData();
      // RN FormData는 { uri, name, type } 구조를 허용
      const name = uri.split('/').pop() ?? 'photo.jpg';
      const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      // @ts-expect-error RN FormData 타입 한계
      form.append('file', { uri, name, type: mime });
      const res = await client.post<ApiResponse<{ url: string; width: number; height: number; key: string }>>(
        '/uploads/photo',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30_000 },
      );
      return res.data.data;
    },
  },

  // ─── 공지사항 ─────────────────────────────────────────────────────────────────
  notices: {
    async list(params: {
      category?: 'general' | 'event' | 'maintenance' | 'update';
      limit?: number;
      cursor?: number;
    } = {}): Promise<NoticeListItem[]> {
      const res = await client.get<ApiResponse<NoticeListItem[]>>('/notices', { params });
      return res.data.data ?? [];
    },
    async get(noticeId: number): Promise<NoticeDetail> {
      const res = await client.get<ApiResponse<NoticeDetail>>(`/notices/${noticeId}`);
      return res.data.data;
    },
  },

  // ─── 렌터카·보험 메타서치 ───────────────────────────────────────────────────────
  rentalCars: {
    async search(params: {
      city: string;
      pickup_date: string;   // YYYY-MM-DD
      return_date: string;
      driver_age?: number;
      insurance_level?: 'none' | 'basic' | 'full';
    }): Promise<RentalCarSearchResult> {
      const res = await client.get<ApiResponse<RentalCarSearchResult>>('/rental-cars/search', {
        params,
        timeout: 12_000,
      });
      return res.data.data;
    },
  },

  // ─── 투어·티켓 메타서치 ─────────────────────────────────────────────────────────
  tours: {
    async search(params: {
      city: string;
      category?: 'activity' | 'attraction' | 'tour' | 'transport' | 'show' | 'food';
      travel_date?: string;
      travelers?: number;
    }): Promise<TourSearchResult> {
      const res = await client.get<ApiResponse<TourSearchResult>>('/tours/search', {
        params,
        timeout: 12_000,
      });
      return res.data.data;
    },
  },

  // ─── 오프라인 가이드 ───────────────────────────────────────────────────────────
  offlineGuides: {
    async list(params: { city?: string } = {}): Promise<OfflineGuideListItem[]> {
      const res = await client.get<ApiResponse<OfflineGuideListItem[]>>('/offline-guides', { params });
      return res.data.data ?? [];
    },
    async get(guideId: number): Promise<OfflineGuideDetail> {
      const res = await client.get<ApiResponse<OfflineGuideDetail>>(`/offline-guides/${guideId}`);
      return res.data.data;
    },
  },

  // ─── 다이렉트 메시지 (DM) ──────────────────────────────────────────────────────
  dm: {
    async conversations(): Promise<DmConversation[]> {
      const res = await client.get<ApiResponse<DmConversation[]>>('/dm/conversations');
      return res.data.data ?? [];
    },
    async unreadCount(): Promise<number> {
      const res = await client.get<ApiResponse<{ unread: number }>>('/dm/unread-count');
      return res.data.data?.unread ?? 0;
    },
    async thread(otherUserId: number, params: { limit?: number; cursor?: number } = {}): Promise<DmMessage[]> {
      const res = await client.get<ApiResponse<DmMessage[]>>(`/dm/${otherUserId}`, { params });
      return res.data.data ?? [];
    },
    async send(otherUserId: number, body: string): Promise<DmMessage> {
      const res = await client.post<ApiResponse<DmMessage>>(`/dm/${otherUserId}`, { body });
      return res.data.data;
    },
  },

  // ─── 쿠폰 ─────────────────────────────────────────────────────────────────────
  coupons: {
    /** 발급 가능한 혜택 목록 (already_claimed 포함) */
    async available(): Promise<AvailableCoupon[]> {
      const res = await client.get<ApiResponse<AvailableCoupon[]>>('/coupons/available');
      return res.data.data ?? [];
    },
    /** 쿠폰 발급 */
    async claim(couponId: number): Promise<MyCoupon> {
      const res = await client.post<ApiResponse<MyCoupon>>(`/coupons/${couponId}/claim`);
      return res.data.data;
    },
    /** 내 쿠폰함 */
    async mine(): Promise<MyCoupon[]> {
      const res = await client.get<ApiResponse<MyCoupon[]>>('/coupons/me');
      return res.data.data ?? [];
    },
    /** 쿠폰 사용 처리 */
    async use(userCouponId: number): Promise<MyCoupon> {
      const res = await client.post<ApiResponse<MyCoupon>>(`/coupons/me/${userCouponId}/use`);
      return res.data.data;
    },
  },

  // ─── 고객센터 FAQ ─────────────────────────────────────────────────────────────
  faqs: {
    async list(params: {
      category?: 'general' | 'account' | 'booking' | 'payment' | 'travel' | 'etc';
    } = {}): Promise<FaqItem[]> {
      const res = await client.get<ApiResponse<FaqItem[]>>('/faqs', { params });
      return res.data.data ?? [];
    },
    async get(faqId: number): Promise<FaqItem> {
      const res = await client.get<ApiResponse<FaqItem>>(`/faqs/${faqId}`);
      return res.data.data;
    },
  },

  // ─── 푸시 알림 토큰 관리 ───────────────────────────────────────────────────────
  notifications: {
    /** Expo Push Token을 서버에 등록 / 갱신 */
    async registerToken(token: string): Promise<void> {
      await client.post('/notifications/push-token', { token });
    },
    /** 로그아웃 또는 권한 거부 시 서버에서 토큰 제거 */
    async unregisterToken(): Promise<void> {
      await client.delete('/notifications/push-token');
    },
    /** 테스트 알림 전송 (개발/스테이징 전용) */
    async sendTest(): Promise<{ sent: number; failed: number }> {
      const res = await client.post<ApiResponse<{ sent: number; failed: number }>>(
        '/notifications/test',
      );
      return res.data.data;
    },
  },

  // ─── Phase 1-2: 일본 여행 도구 ─────────────────────────────────────────────
  utils: {
    /** 환율 (서버 1시간 캐시). 1 base = rate target */
    async exchangeRate(base: string, target: string): Promise<{
      base: string; target: string; rate: number; fetched_at: number; cached: boolean;
    }> {
      const res = await client.get<ApiResponse<{
        base: string; target: string; rate: number; fetched_at: number; cached: boolean;
      }>>('/utils/exchange-rate', { params: { base, target } });
      return res.data.data;
    },
  },

  japanese: {
    /** 한국어 → 일본어 회화 (Gemini). 30회/시간 제한. */
    async translate(body: {
      text: string;
      context?: 'restaurant' | 'shopping' | 'transport' | 'hotel' | 'emergency' | 'casual';
      formality?: 'polite' | 'casual';
    }): Promise<{ korean: string; japanese: string; hiragana: string; romaji: string; note: string | null }> {
      const res = await client.post<ApiResponse<{
        korean: string; japanese: string; hiragana: string; romaji: string; note: string | null;
      }>>('/ai/japanese-phrase', body, { timeout: 30_000 });
      return res.data.data;
    },
  },

  collaboration: {
    async createInvite(tripId: number, role: 'edit' | 'view' = 'edit'): Promise<{
      token: string; role: string; expires_at: string; share_url: string;
    }> {
      const res = await client.post<ApiResponse<{
        token: string; role: string; expires_at: string; share_url: string;
      }>>(`/trips/${tripId}/invite`, { role });
      return res.data.data;
    },
    async acceptInvite(token: string): Promise<{ user_id: number; role: string; joined_at: string }> {
      const res = await client.post<ApiResponse<{ user_id: number; role: string; joined_at: string }>>(
        '/trips/invite/accept', { token },
      );
      return res.data.data;
    },
    async listCollaborators(tripId: number): Promise<Array<{ user_id: number; role: string; joined_at: string; nickname: string | null }>> {
      const res = await client.get<ApiResponse<Array<{ user_id: number; role: string; joined_at: string; nickname: string | null }>>>(
        `/trips/${tripId}/collaborators`,
      );
      return res.data.data ?? [];
    },
    /** 협업자 역할 변경 (여행 소유자만). */
    async updateCollaboratorRole(
      tripId: number,
      userId: number,
      role: 'edit' | 'view',
    ): Promise<{ user_id: number; role: string; joined_at: string }> {
      const res = await client.patch<ApiResponse<{ user_id: number; role: string; joined_at: string }>>(
        `/trips/${tripId}/collaborators/${userId}`,
        { role },
      );
      return res.data.data;
    },
    /** 협업자 제거 (여행 소유자만). */
    async removeCollaborator(tripId: number, userId: number): Promise<void> {
      await client.delete(`/trips/${tripId}/collaborators/${userId}`);
    },
    async getInviteInfo(token: string): Promise<{
      trip_title: string; inviter_nickname: string; expires_at: string;
    }> {
      const res = await client.get<ApiResponse<{
        trip_title: string; inviter_nickname: string; expires_at: string;
      }>>(`/trips/invite/info/${token}`);
      return res.data.data;
    },
  },

  metasearch: {
    async flights(params: {
      from_iata: string;
      to_iata: string;
      depart_date: string;        // YYYY-MM-DD
      return_date?: string;
      adults?: number;
      cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
    }): Promise<FlightSearchResult> {
      const res = await client.get<ApiResponse<FlightSearchResult>>('/metasearch/flights', {
        params, timeout: 12_000,
      });
      return res.data.data;
    },
    async hotels(params: {
      city: string;
      checkin: string;
      checkout: string;
      adults?: number;
      rooms?: number;
      min_rating?: number;
      women_friendly_only?: boolean;
    }): Promise<HotelSearchResult> {
      const res = await client.get<ApiResponse<HotelSearchResult>>('/metasearch/hotels', {
        params, timeout: 12_000,
      });
      return res.data.data;
    },

    async subscribeFlightAlert(params: {
      from_iata: string;
      to_iata: string;
      depart_date: string;      // YYYY-MM-DD
      return_date?: string;
      cabin?: string;
      adults?: number;
      drop_threshold_pct?: number;
    }): Promise<{ id: number; from_iata: string; to_iata: string; depart_date: string; is_active: boolean }> {
      const res = await client.post<ApiResponse<{
        id: number; from_iata: string; to_iata: string; depart_date: string; is_active: boolean;
      }>>('/metasearch/alerts/flights', params);
      return res.data.data;
    },

    async unsubscribeFlightAlert(alertId: number): Promise<void> {
      await client.delete(`/metasearch/alerts/flights/${alertId}`);
    },

    async listFlightAlerts(): Promise<Array<{
      id: number; from_iata: string; to_iata: string; depart_date: string; is_active: boolean;
    }>> {
      const res = await client.get<ApiResponse<Array<{
        id: number; from_iata: string; to_iata: string; depart_date: string; is_active: boolean;
      }>>>('/metasearch/alerts/flights');
      return res.data.data ?? [];
    },
  },

  community: {
    async feed(params: { city?: string; category?: string; post_type?: 'regular' | 'live'; limit?: number; cursor?: number } = {}): Promise<CommunityPost[]> {
      const res = await client.get<ApiResponse<CommunityPost[]>>('/community/feed', { params });
      return res.data.data ?? [];
    },
    async liveFeed(params: { city?: string; limit?: number } = {}): Promise<CommunityPost[]> {
      const res = await client.get<ApiResponse<CommunityPost[]>>('/community/feed/live', { params });
      return res.data.data ?? [];
    },
    async createPost(body: {
      post_type?: 'regular' | 'live';
      category: 'qna' | 'review' | 'photospot';
      city?: string;
      title: string;
      body: string;
      images?: string[];
    }): Promise<CommunityPost> {
      const res = await client.post<ApiResponse<CommunityPost>>('/community/posts', body);
      return res.data.data;
    },
    async getPost(postId: number): Promise<CommunityPost> {
      const res = await client.get<ApiResponse<CommunityPost>>(`/community/posts/${postId}`);
      return res.data.data;
    },
    async deletePost(postId: number): Promise<void> {
      await client.delete(`/community/posts/${postId}`);
    },
    async listComments(postId: number): Promise<CommunityComment[]> {
      const res = await client.get<ApiResponse<CommunityComment[]>>(`/community/posts/${postId}/comments`);
      return res.data.data ?? [];
    },
    async createComment(postId: number, body: string): Promise<CommunityComment> {
      const res = await client.post<ApiResponse<CommunityComment>>(`/community/posts/${postId}/comments`, { body });
      return res.data.data;
    },
    async toggleLike(postId: number): Promise<{ liked: boolean; like_count: number }> {
      const res = await client.post<ApiResponse<{ liked: boolean; like_count: number }>>(`/community/posts/${postId}/like`);
      return res.data.data;
    },
    async report(postId: number, body: { reason: 'spam' | 'hate' | 'sexual' | 'other'; detail?: string }): Promise<void> {
      await client.post(`/community/posts/${postId}/report`, body);
    },
    async trending(params: { period?: '1d' | '7d' | '30d'; limit?: number } = {}): Promise<TrendingPost[]> {
      const res = await client.get<ApiResponse<TrendingPost[]>>('/community/trending', { params });
      return res.data.data ?? [];
    },
  },

  users: {
    async stats(): Promise<UserStats> {
      const res = await client.get<ApiResponse<UserStats>>('/auth/me/stats');
      return res.data.data;
    },
    async gamification(): Promise<Gamification> {
      const res = await client.get<ApiResponse<Gamification>>('/auth/me/gamification');
      return res.data.data;
    },
    async updateProfile(body: { nickname?: string; profile_image_url?: string }): Promise<{
      id: number;
      email: string;
      nickname: string;
      profile_image_url: string | null;
    }> {
      const res = await client.patch<ApiResponse<{
        id: number;
        email: string;
        nickname: string;
        profile_image_url: string | null;
      }>>('/auth/me', body);
      return res.data.data;
    },
  },

  korean: {
    /** 일본어 → 한국어 회화 (Gemini). 일본인 관광객용. */
    async translate(body: {
      text: string;
      context?: 'restaurant' | 'shopping' | 'transport' | 'hotel' | 'emergency' | 'casual';
      formality?: 'polite' | 'casual';
    }): Promise<{ japanese: string; korean: string; romanized: string; note: string | null }> {
      const res = await client.post<ApiResponse<{
        japanese: string; korean: string; romanized: string; note: string | null;
      }>>('/ai/korean-phrase', body, { timeout: 30_000 });
      return res.data.data;
    },
  },

  // ─── UP-7: 여행 공유 ──────────────────────────────────────────────────────────
  trips_share: {
    async create(tripId: number): Promise<{ share_token: string; share_url: string }> {
      const res = await client.post<ApiResponse<{ share_token: string; share_url: string }>>(
        `/trips/${tripId}/share`,
      );
      return res.data.data;
    },
    async getShared(shareToken: string): Promise<{ trip: Trip; locations: Location[] }> {
      const res = await client.get<ApiResponse<{ trip: Trip; locations: Location[] }>>(
        `/trips/shared/${shareToken}`,
      );
      return res.data.data;
    },
  },
} as const;

// ─── 인증 헬퍼 ────────────────────────────────────────────────────────────────

export async function saveToken(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    secureSet(SECURE_TOKEN_KEY, accessToken),
    secureSet(SECURE_REFRESH_KEY, refreshToken),
  ]);
}

export async function clearToken(): Promise<void> {
  await Promise.all([
    secureDelete(SECURE_TOKEN_KEY),
    secureDelete(SECURE_REFRESH_KEY),
    // 구버전 잔여 토큰도 정리
    AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
    AsyncStorage.removeItem(LEGACY_REFRESH_KEY),
  ]);
}

/**
 * 구버전 AsyncStorage 평문 토큰을 SecureStore로 1회 이전.
 * 이전 후 AsyncStorage에서 제거하여 평문 잔여물을 남기지 않음.
 */
async function migrateLegacyTokens(): Promise<void> {
  const [legacyAccess, legacyRefresh] = await Promise.all([
    AsyncStorage.getItem(LEGACY_TOKEN_KEY),
    AsyncStorage.getItem(LEGACY_REFRESH_KEY),
  ]);
  if (legacyAccess && legacyRefresh) {
    await saveToken(legacyAccess, legacyRefresh);
  }
  if (legacyAccess || legacyRefresh) {
    await Promise.all([
      AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_REFRESH_KEY),
    ]);
  }
}

export async function getStoredToken(): Promise<string | null> {
  const token = await secureGet(SECURE_TOKEN_KEY);
  if (token) return token;
  // SecureStore가 비어 있으면 구버전 토큰 마이그레이션 시도
  await migrateLegacyTokens();
  return secureGet(SECURE_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return secureGet(SECURE_REFRESH_KEY);
}
