/**
 * lib/trip-utils.ts 테스트
 * - categoryEmoji
 * - formatDate
 * - dayLabel
 * - groupByDay
 */

import { categoryEmoji, formatDate, dayLabel, groupByDay, CATEGORIES } from '@/lib/trip-utils';
import type { Location } from '@/lib/types';

// ─── categoryEmoji ────────────────────────────────────────────────────────────

describe('categoryEmoji', () => {
  it('등록된 카테고리는 올바른 이모지 반환', () => {
    expect(categoryEmoji('관광지')).toBe('🏛️');
    expect(categoryEmoji('음식점')).toBe('🍜');
    expect(categoryEmoji('숙소')).toBe('🏨');
    expect(categoryEmoji('카페')).toBe('☕');
    expect(categoryEmoji('쇼핑')).toBe('🛍️');
    expect(categoryEmoji('자연')).toBe('🌿');
    expect(categoryEmoji('문화')).toBe('🎭');
    expect(categoryEmoji('액티비티')).toBe('🎢');
  });

  it('미등록 카테고리는 기본 핀 이모지', () => {
    expect(categoryEmoji('기타')).toBe('📍');
    expect(categoryEmoji('')).toBe('📍');
    expect(categoryEmoji('restaurant')).toBe('📍');
  });

  it('CATEGORIES 배열의 모든 항목이 매핑됨', () => {
    for (const cat of CATEGORIES) {
      expect(categoryEmoji(cat.key)).toBe(cat.emoji);
    }
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('null 입력은 빈 문자열', () => {
    expect(formatDate(null, 'ko')).toBe('');
    expect(formatDate(null, 'en')).toBe('');
  });

  it('한국어 형식: M월 D일', () => {
    const result = formatDate('2026-04-01', 'ko');
    expect(result).toMatch(/4월/);
    expect(result).toMatch(/1일/);
  });

  it('영어 형식: Mon DD', () => {
    const result = formatDate('2026-12-25', 'en');
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
  });
});

// ─── dayLabel ─────────────────────────────────────────────────────────────────

describe('dayLabel', () => {
  it('startDate 없으면 Day N 형식', () => {
    expect(dayLabel(1, null, 'ko')).toBe('Day 1');
    expect(dayLabel(3, null, 'en')).toBe('Day 3');
  });

  it('startDate 있으면 날짜 포함', () => {
    const result = dayLabel(1, '2026-04-01', 'ko');
    expect(result).toContain('Day 1');
    expect(result).toContain('4월');
    expect(result).toContain('1일');
  });

  it('Day 2는 startDate + 1일', () => {
    const result = dayLabel(2, '2026-04-01', 'ko');
    expect(result).toContain('Day 2');
    expect(result).toContain('4월');
    expect(result).toContain('2일');
  });
});

// ─── groupByDay ───────────────────────────────────────────────────────────────

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 1,
    trip_id: 1,
    name: '테스트 장소',
    address: '서울시',
    latitude: 37.5,
    longitude: 127.0,
    category: '관광지',
    visit_order: 0,
    day_index: 1,
    notes: null,
    phone: null,
    opening_hours: null,
    estimated_minutes: null,
    budget_per_person: null,
    website: null,
    rating: null,
    images: null,
    google_place_id: null,
    created_at: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('groupByDay', () => {
  it('빈 배열은 빈 그룹 반환', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('단일 날짜 그룹화', () => {
    const locs = [
      makeLocation({ id: 1, day_index: 1, visit_order: 0 }),
      makeLocation({ id: 2, day_index: 1, visit_order: 1 }),
    ];
    const groups = groupByDay(locs);
    expect(groups).toHaveLength(1);
    expect(groups[0].day).toBe(1);
    expect(groups[0].locations).toHaveLength(2);
  });

  it('여러 날짜 day 순으로 정렬', () => {
    const locs = [
      makeLocation({ id: 3, day_index: 3, visit_order: 0 }),
      makeLocation({ id: 1, day_index: 1, visit_order: 0 }),
      makeLocation({ id: 2, day_index: 2, visit_order: 0 }),
    ];
    const groups = groupByDay(locs);
    expect(groups.map((g) => g.day)).toEqual([1, 2, 3]);
  });

  it('같은 날 내 visit_order 오름차순 정렬', () => {
    const locs = [
      makeLocation({ id: 1, day_index: 1, visit_order: 2 }),
      makeLocation({ id: 2, day_index: 1, visit_order: 0 }),
      makeLocation({ id: 3, day_index: 1, visit_order: 1 }),
    ];
    const groups = groupByDay(locs);
    expect(groups[0].locations.map((l) => l.visit_order)).toEqual([0, 1, 2]);
  });

  it('day_index 없으면 1로 처리', () => {
    const loc = makeLocation({ day_index: undefined as unknown as number });
    const groups = groupByDay([loc]);
    expect(groups[0].day).toBe(1);
  });
});
