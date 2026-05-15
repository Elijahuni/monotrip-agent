import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

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
import type { ChecklistItem, DestinationGuide, Location, SavedPlace, Trip, UserCache } from '@/lib/types';
import { z } from 'zod';

// ─── 환경 변수 ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const TOKEN_KEY = '@triple/access_token';

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
  token_type: string;
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

// ─── Axios 인스턴스 ───────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터: AsyncStorage에서 토큰을 읽어 Authorization 헤더 주입
client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401이면 authStore.logout() → status='guest'로 전환되어
// (tabs) layout이 자동으로 /auth/login으로 redirect.
//
// 인증 자체가 필요 없는 엔드포인트(/auth/login, /auth/register)에서 발생한
// 401(예: 잘못된 비밀번호)은 로그아웃 처리하지 않고 호출자에게 그대로 전달.
//
// 429 (rate limit) 에러는 토스트로 안내.
//
// store ← api 순환 import를 피하기 위해 dynamic import 사용.
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

    if (status === 401 && !isAuthEndpoint) {
      try {
        const { useAuthStore } = await import('@/store');
        await useAuthStore.getState().logout();
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
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
  },

  trips: {
    async getAll(): Promise<Trip[]> {
      const res = await client.get<ApiResponse<Trip[]>>('/trips');
      return parseResp(z.array(tripSchema), res.data.data, 'trips.getAll');
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

    async update(tripId: number, locationId: number, body: Partial<Location>): Promise<Location> {
      const res = await client.patch<ApiResponse<Location>>(
        `/trips/${tripId}/locations/${locationId}`,
        body,
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
    }): Promise<{ title: string; description: string; locations: Location[] }> {
      const res = await client.get('/ai/recommend', { params: { ...params, travel_style: params.travel_style } });
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
      });
      return res.data.data;
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
      const res = await client.post('/ai/recommend/refine', body);
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

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
