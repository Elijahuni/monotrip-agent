/**
 * VibeChips — vibe 태그 다중 선택 칩 그룹.
 * 큐레이션 화면(상단 필터) + AI 빌더(취향 입력)에서 공용 사용.
 *
 * 언어 전환: 내부적으로는 항상 한국어 값(VIBE_TAGS)으로 필터링 요청을 보내고,
 * 화면에 표시되는 라벨만 lang에 따라 전환됨.
 */
import { ScrollView, Text, TouchableOpacity } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';

/** 백엔드 schemas/curated_place.py::VIBE_TAGS와 동기화 (한국어 값 — 필터링 키) */
export const VIBE_TAGS = [
  '빈티지', '모던', '레트로', '한적', '감성', '인스타',
  '야경', '분위기', '조용', '활기', '고급', '가성비',
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

/** 한국어 vibe 태그 → 영어 표시 라벨 매핑 */
export const VIBE_TAG_EN: Record<VibeTag, string> = {
  '빈티지': 'Vintage',
  '모던':   'Modern',
  '레트로': 'Retro',
  '한적':   'Quiet',
  '감성':   'Cozy',
  '인스타': 'Instaworthy',
  '야경':   'Night View',
  '분위기': 'Ambiance',
  '조용':   'Peaceful',
  '활기':   'Lively',
  '고급':   'Upscale',
  '가성비': 'Value',
};

/** vibe 태그 한국어 값을 현재 언어에 맞는 표시 라벨로 변환 */
export function localizeVibeTag(tag: string, lang: 'ko' | 'en'): string {
  if (lang === 'ko') return tag;
  return VIBE_TAG_EN[tag as VibeTag] ?? tag;
}

interface VibeChipsProps {
  selected: string[];
  onChange: (next: string[]) => void;
  /** 한 번에 선택 가능한 최대 개수 (기본 4) */
  max?: number;
}

export function VibeChips({ selected, onChange, max = 4 }: VibeChipsProps) {
  const colors = useThemedColors();
  const { lang } = useSettings();

  const toggle = (tag: VibeTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, tag]);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      {VIBE_TAGS.map((tag) => {
        const active = selected.includes(tag);
        const label = localizeVibeTag(tag, lang);
        return (
          <TouchableOpacity
            key={tag}
            onPress={() => toggle(tag)}
            activeOpacity={0.7}
            style={{
              flexShrink: 0,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
              borderColor: active ? colors.brandPrimary : colors.lineDefault,
            }}>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: active ? '#FFFFFF' : colors.txSecondary,
              }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
