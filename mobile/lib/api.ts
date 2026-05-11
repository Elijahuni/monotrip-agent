import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import type { Location, Trip, UserCache } from '@/lib/types';

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

export const api = {
  auth: {
    async register(body: RegisterRequest): Promise<UserResponse> {
      const res = await client.post<ApiResponse<UserResponse>>('/auth/register', body);
      return res.data.data;
    },

    async login(body: LoginRequest): Promise<TokenResponse> {
      const res = await client.post<ApiResponse<TokenResponse>>('/auth/login', body);
      return res.data.data;
    },

    async me(): Promise<UserResponse> {
      const res = await client.get<ApiResponse<UserResponse>>('/auth/me');
      return res.data.data;
    },
  },

  trips: {
    async getAll(): Promise<Trip[]> {
      const res = await client.get<ApiResponse<Trip[]>>('/trips');
      return res.data.data;
    },

    async getOne(tripId: number): Promise<TripDetail> {
      const res = await client.get<ApiResponse<TripDetail>>(`/trips/${tripId}`);
      return res.data.data;
    },

    async create(body: TripCreateRequest): Promise<TripDetail> {
      const res = await client.post<ApiResponse<TripDetail>>('/trips', body);
      return res.data.data;
    },

    async update(tripId: number, body: Partial<TripCreateRequest>): Promise<TripDetail> {
      const res = await client.patch<ApiResponse<TripDetail>>(`/trips/${tripId}`, body);
      return res.data.data;
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
      return res.data.data;
    },

    async update(tripId: number, locationId: number, body: Partial<Location>): Promise<Location> {
      const res = await client.patch<ApiResponse<Location>>(
        `/trips/${tripId}/locations/${locationId}`,
        body,
      );
      return res.data.data;
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
