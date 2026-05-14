/**
 * 장소 카테고리 단일 정의.
 * trips/[id], explore, 추후 장소 추가 화면이 동일 소스 사용.
 */

export const CATEGORIES = [
  '숙소', '음식점', '관광지', '카페', '쇼핑', '자연', '문화', '엔터테인먼트',
] as const;

export type Category = (typeof CATEGORIES)[number];

const ICONS: Record<string, string> = {
  숙소: '🏨',
  음식점: '🍜',
  관광지: '🗺️',
  카페: '☕',
  쇼핑: '🛍️',
  자연: '🌿',
  문화: '🏛️',
  엔터테인먼트: '🎭',
};

export function categoryIcon(category: string): string {
  return ICONS[category] ?? '📍';
}
