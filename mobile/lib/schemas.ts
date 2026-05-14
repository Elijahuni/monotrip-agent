/**
 * API 응답 / 폼 입력에 사용하는 Zod 스키마.
 * 백엔드 Pydantic 모델과 1:1 대응.
 *
 * 사용 예:
 *   const trip = tripSchema.parse(json);     // 실패 시 throw
 *   const safe = tripSchema.safeParse(json); // { success, data | error }
 */

import { z } from 'zod';

// ─── 기본 타입 ─────────────────────────────────────────────────────────────────

/** ISO datetime 문자열 — 백엔드에서 항상 ISO 8601 */
const isoDateTime = z.string().min(1);

/** 'YYYY-MM-DD' 또는 null */
const ymdOrNull = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

// ─── 도메인 스키마 ────────────────────────────────────────────────────────────

export const tripSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullable(),
  start_date: ymdOrNull,
  end_date: ymdOrNull,
  thumbnail_url: z.string().nullable(),
  created_at: isoDateTime,
  updated_at: isoDateTime,
});

export const locationSchema = z.object({
  id: z.number().int().positive(),
  trip_id: z.number().int().positive(),
  name: z.string().min(1),
  address: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string(),
  visit_order: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  created_at: isoDateTime,
});

export const tripDetailSchema = tripSchema.extend({
  locations: z.array(locationSchema),
});

export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  nickname: z.string().min(1),
  profile_image_url: z.string().nullable(),
  created_at: isoDateTime,
});

export const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
});

export const placeSearchResultSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string(),
  photo_url: z.string().nullable(),
  rating: z.number().nullable(),
  user_ratings_total: z.number().nullable(),
});

export const placeSearchResponseSchema = z.object({
  results: z.array(placeSearchResultSchema),
});

export const aiLocationPlanSchema = z.object({
  name: z.string().min(1),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string(),
  visit_order: z.number().int().nonnegative(),
  notes: z.string().nullable(),
});

export const aiTripPlanSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  locations: z.array(aiLocationPlanSchema),
});

export type AiLocationPlan = z.infer<typeof aiLocationPlanSchema>;

// ─── 폼 입력 스키마 ────────────────────────────────────────────────────────────

export const tripFormSchema = z
  .object({
    title: z.string().trim().min(1, '여행명을 입력해주세요'),
    start_date: ymdOrNull,
    end_date: ymdOrNull,
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.start_date <= v.end_date,
    { message: '귀국일은 출발일 이후여야 합니다', path: ['end_date'] },
  );

export const loginFormSchema = z.object({
  email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export const registerFormSchema = z.object({
  nickname: z.string().trim().min(1, '닉네임을 입력해주세요').max(30, '닉네임이 너무 깁니다'),
  email: z.string().trim().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

export const locationFormSchema = z.object({
  name: z.string().trim().min(1, '장소명을 입력해주세요'),
  address: z.string().trim().min(1, '주소를 입력해주세요'),
  category: z.string().min(1),
  notes: z.string().nullable(),
});

// ─── 타입 export (lib/types.ts 와 동일 형태) ────────────────────────────────────

export type Trip = z.infer<typeof tripSchema>;
export type Location = z.infer<typeof locationSchema>;
export type TripDetail = z.infer<typeof tripDetailSchema>;
export type User = z.infer<typeof userSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type AiTripPlan = z.infer<typeof aiTripPlanSchema>;
export type PlaceSearchResult = z.infer<typeof placeSearchResultSchema>;

export type TripFormInput = z.infer<typeof tripFormSchema>;
export type LoginFormInput = z.infer<typeof loginFormSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type LocationFormInput = z.infer<typeof locationFormSchema>;

// ─── 안전 파싱 헬퍼 ────────────────────────────────────────────────────────────

/**
 * API 응답을 검증. 실패 시 콘솔에 상세 로그 후 원본 반환(graceful degradation).
 * 백엔드/스키마 불일치를 조기 감지하면서도 사용자 경험을 깨지 않는다.
 */
export function safeParse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[schema] ${label} 검증 실패:`, result.error.issues);
    }
    return value as T;
  }
  return result.data;
}
