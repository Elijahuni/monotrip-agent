/**
 * lib/schemas.ts 테스트
 * - 각 스키마의 정상 파싱 / 실패 케이스
 * - safeParse 헬퍼의 graceful degradation
 */

import {
  tripSchema,
  locationSchema,
  tripDetailSchema,
  userSchema,
  tokenSchema,
  loginFormSchema,
  registerFormSchema,
  tripFormSchema,
  safeParse,
} from '@/lib/schemas';

// ─── tripSchema ───────────────────────────────────────────────────────────────

const VALID_TRIP = {
  id: 1,
  user_id: 1,
  title: '도쿄 여행',
  destination: '도쿄',
  description: '즐거운 여행',
  start_date: '2026-04-01',
  end_date: '2026-04-05',
  thumbnail_url: null,
  total_budget: null,
  group_size: 2,
  share_token: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('tripSchema', () => {
  it('유효한 Trip 파싱 성공', () => {
    const result = tripSchema.safeParse(VALID_TRIP);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('도쿄 여행');
      expect(result.data.id).toBe(1);
    }
  });

  it('destination null → null 변환', () => {
    const result = tripSchema.safeParse({ ...VALID_TRIP, destination: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destination).toBeNull();
  });

  it('destination undefined → null 변환', () => {
    const { destination: _d, ...rest } = VALID_TRIP;
    const result = tripSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destination).toBeNull();
  });

  it('잘못된 날짜 형식은 파싱 실패', () => {
    const result = tripSchema.safeParse({ ...VALID_TRIP, start_date: '2026/04/01' });
    expect(result.success).toBe(false);
  });

  it('id 없으면 파싱 실패', () => {
    const { id: _id, ...rest } = VALID_TRIP;
    expect(tripSchema.safeParse(rest).success).toBe(false);
  });

  it('title 빈 문자열이면 파싱 실패', () => {
    expect(tripSchema.safeParse({ ...VALID_TRIP, title: '' }).success).toBe(false);
  });
});

// ─── locationSchema ───────────────────────────────────────────────────────────

const VALID_LOCATION = {
  id: 1,
  trip_id: 1,
  name: '도쿄 스카이트리',
  address: '일본 도쿄도 스미다구',
  latitude: 35.71,
  longitude: 139.81,
  category: '관광지',
  visit_order: 0,
  day_index: 1,
  notes: null,
  phone: null,
  opening_hours: null,
  estimated_minutes: null,
  budget_per_person: null,
  website: null,
  rating: 4.5,
  images: null,
  google_place_id: null,
  created_at: '2026-01-01T00:00:00Z',
};

describe('locationSchema', () => {
  it('유효한 Location 파싱 성공', () => {
    const result = locationSchema.safeParse(VALID_LOCATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('도쿄 스카이트리');
      expect(result.data.latitude).toBeCloseTo(35.71);
    }
  });

  it('images 배열 허용', () => {
    const result = locationSchema.safeParse({ ...VALID_LOCATION, images: ['https://img.test/1.jpg'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.images).toEqual(['https://img.test/1.jpg']);
  });

  it('images null → null 변환', () => {
    const result = locationSchema.safeParse({ ...VALID_LOCATION, images: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.images).toBeNull();
  });

  it('위도 범위 초과 파싱 실패', () => {
    expect(locationSchema.safeParse({ ...VALID_LOCATION, latitude: 91 }).success).toBe(false);
    expect(locationSchema.safeParse({ ...VALID_LOCATION, latitude: -91 }).success).toBe(false);
  });

  it('경도 범위 초과 파싱 실패', () => {
    expect(locationSchema.safeParse({ ...VALID_LOCATION, longitude: 181 }).success).toBe(false);
  });
});

// ─── tripDetailSchema ─────────────────────────────────────────────────────────

describe('tripDetailSchema', () => {
  it('locations 배열 포함 파싱', () => {
    const data = { ...VALID_TRIP, locations: [VALID_LOCATION] };
    const result = tripDetailSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locations).toHaveLength(1);
      expect(result.data.locations[0].name).toBe('도쿄 스카이트리');
    }
  });

  it('빈 locations 배열도 유효', () => {
    const result = tripDetailSchema.safeParse({ ...VALID_TRIP, locations: [] });
    expect(result.success).toBe(true);
  });
});

// ─── userSchema ───────────────────────────────────────────────────────────────

describe('userSchema', () => {
  const VALID_USER = {
    id: 1,
    email: 'test@example.com',
    nickname: '여행자',
    profile_image_url: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('유효한 User 파싱', () => {
    const result = userSchema.safeParse(VALID_USER);
    expect(result.success).toBe(true);
  });

  it('이메일 형식 오류 실패', () => {
    expect(userSchema.safeParse({ ...VALID_USER, email: 'not-email' }).success).toBe(false);
  });
});

// ─── tokenSchema ──────────────────────────────────────────────────────────────

describe('tokenSchema', () => {
  it('유효한 토큰 파싱', () => {
    const result = tokenSchema.safeParse({
      access_token: 'eyJhbGc...',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 900,
    });
    expect(result.success).toBe(true);
  });

  it('refresh_token 없으면 실패', () => {
    expect(tokenSchema.safeParse({
      access_token: 'token',
      token_type: 'bearer',
      expires_in: 900,
    }).success).toBe(false);
  });
});

// ─── 폼 스키마 ────────────────────────────────────────────────────────────────

describe('loginFormSchema', () => {
  it('유효한 로그인 입력', () => {
    expect(loginFormSchema.safeParse({ email: 'test@test.com', password: 'pass' }).success).toBe(true);
  });

  it('이메일 형식 오류', () => {
    expect(loginFormSchema.safeParse({ email: 'badmail', password: 'pass' }).success).toBe(false);
  });

  it('비밀번호 빈 문자열', () => {
    expect(loginFormSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('registerFormSchema', () => {
  it('유효한 회원가입 입력', () => {
    expect(registerFormSchema.safeParse({
      nickname: '여행자',
      email: 'user@example.com',
      password: 'password123',
    }).success).toBe(true);
  });

  it('비밀번호 8자 미만 실패', () => {
    expect(registerFormSchema.safeParse({
      nickname: '여행자',
      email: 'user@example.com',
      password: 'short',
    }).success).toBe(false);
  });

  it('닉네임 빈 문자열 실패', () => {
    expect(registerFormSchema.safeParse({
      nickname: '',
      email: 'user@example.com',
      password: 'password123',
    }).success).toBe(false);
  });
});

describe('tripFormSchema', () => {
  it('유효한 여행 폼 입력', () => {
    expect(tripFormSchema.safeParse({
      title: '도쿄 여행',
      start_date: '2026-04-01',
      end_date: '2026-04-05',
    }).success).toBe(true);
  });

  it('귀국일이 출발일보다 이른 경우 실패', () => {
    expect(tripFormSchema.safeParse({
      title: '도쿄 여행',
      start_date: '2026-04-05',
      end_date: '2026-04-01',
    }).success).toBe(false);
  });

  it('날짜 없어도 유효', () => {
    expect(tripFormSchema.safeParse({
      title: '여행',
      start_date: null,
      end_date: null,
    }).success).toBe(true);
  });

  it('제목 빈 문자열 실패', () => {
    expect(tripFormSchema.safeParse({ title: '   ', start_date: null, end_date: null }).success).toBe(false);
  });
});

// ─── safeParse 헬퍼 ───────────────────────────────────────────────────────────

describe('safeParse', () => {
  it('유효한 데이터는 파싱 결과 반환', () => {
    const result = safeParse(tripSchema, VALID_TRIP, 'trip');
    expect(result.id).toBe(1);
  });

  it('유효하지 않은 데이터는 원본 반환 (graceful degradation)', () => {
    const bad = { id: 'not-a-number' };
    const result = safeParse(tripSchema, bad, 'trip');
    expect(result).toBe(bad);
  });
});
