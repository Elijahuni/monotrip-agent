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
import type { Location, Trip, UserCache } from '@/lib/types';
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

export interface TripCreateRequest {
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  thumbnail_url?: string | null;
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

// 응답 인터셉터: 401이면 저장된 토큰 삭제 (자동 로그아웃)
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
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
    }): Promise<{ title: string; description: string; locations: Location[] }> {
      const res = await client.get('/ai/recommend', { params });
      return parseResp(aiTripPlanSchema, res.data.data, 'ai.recommend') as {
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
