import { Text, TouchableOpacity, View } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

/**
 * 분절 컨트롤 — Phase 6의 장소 추가 모드(검색/지도/현재위치) 전환 등에 사용.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  const colors = useThemedColors();
  return (
    <View className={`flex-row bg-bg-subtle rounded-xl p-1 ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-1.5 ${
              isActive ? 'bg-bg-surface' : ''
            }`}
            style={isActive ? {
              shadowColor: colors.shadowColor,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 1,
            } : undefined}
            activeOpacity={0.8}
            onPress={() => onChange(opt.value)}>
            {opt.icon ? <Text className="text-sm">{opt.icon}</Text> : null}
            <Text className={`text-sm font-semibold ${isActive ? 'text-tx-primary' : 'text-tx-tertiary'}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
