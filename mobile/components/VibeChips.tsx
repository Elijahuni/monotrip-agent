/**
 * VibeChips — vibe 태그 다중 선택 칩 그룹.
 * 큐레이션 화면(상단 필터) + AI 빌더(취향 입력)에서 공용 사용.
 */
import { ScrollView, Text, TouchableOpacity } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';

/** 백엔드 schemas/curated_place.py::VIBE_TAGS와 동기화 */
export const VIBE_TAGS = [
  '빈티지', '모던', '레트로', '한적', '감성', '인스타',
  '야경', '분위기', '조용', '활기', '고급', '가성비',
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

interface VibeChipsProps {
  selected: string[];
  onChange: (next: string[]) => void;
  /** 한 번에 선택 가능한 최대 개수 (기본 4) */
  max?: number;
}

export function VibeChips({ selected, onChange, max = 4 }: VibeChipsProps) {
  const colors = useThemedColors();

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
              {tag}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
