import type { Location } from '@/lib/types';

export const CATEGORIES = [
  { label: '관광지',   emoji: '🏛️', key: '관광지' },
  { label: '음식점',   emoji: '🍜', key: '음식점' },
  { label: '숙소',     emoji: '🏨', key: '숙소' },
  { label: '카페',     emoji: '☕', key: '카페' },
  { label: '쇼핑',     emoji: '🛍️', key: '쇼핑' },
  { label: '자연',     emoji: '🌿', key: '자연' },
  { label: '문화',     emoji: '🎭', key: '문화' },
  { label: '액티비티', emoji: '🎢', key: '액티비티' },
];

export function categoryEmoji(cat: string): string {
  return CATEGORIES.find((c) => c.key === cat)?.emoji ?? '📍';
}

export function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (lang === 'ko') return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dayLabel(dayIndex: number, startDate: string | null, lang: string): string {
  const prefix = `Day ${dayIndex}`;
  if (!startDate) return prefix;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex - 1);
  return `${prefix}  ·  ${formatDate(d.toISOString(), lang)}`;
}

export function groupByDay(locations: Location[]): Array<{ day: number; locations: Location[] }> {
  const map = new Map<number, Location[]>();
  for (const loc of locations) {
    const day = loc.day_index ?? 1;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(loc);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, locs]) => ({ day, locations: locs.sort((a, b) => a.visit_order - b.visit_order) }));
}
