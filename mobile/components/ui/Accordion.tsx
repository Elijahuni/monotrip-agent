/**
 * Accordion — 디자인 토큰 기반 애니메이션 아코디언.
 *
 * - 헤더 탭 시 본문이 부드럽게 펼쳐짐(LayoutAnimation, 네이티브 높이 전환)
 * - chevron 회전은 reanimated로 처리
 * - 단독 사용 또는 AccordionGroup으로 "한 번에 하나만 열림" 제어 가능
 */
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { useThemedColors } from '@/lib/design-tokens';
import { tapLight } from '@/lib/haptics';

// Android에서 LayoutAnimation 활성화 (1회)
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionProps {
  title: string;
  /** 헤더 좌측 보조 라벨(예: "Q") */
  badge?: string;
  /** 우측 작은 라벨(예: 카테고리) */
  rightLabel?: string;
  defaultOpen?: boolean;
  /** 제어형으로 쓸 때 */
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: ReactNode;
}

export function Accordion({
  title,
  badge,
  rightLabel,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}: AccordionProps) {
  const colors = useThemedColors();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const rotation = useDerivedValue(() => withTiming(open ? 90 : 0, { duration: 180 }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  function toggle() {
    tapLight();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !open;
    if (isControlled) onToggle?.(next);
    else setUncontrolledOpen(next);
  }

  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.lineDefault,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
      >
        {badge ? (
          <Text style={{ color: colors.brandPrimary, fontWeight: '800', fontSize: 15, marginRight: 8 }}>
            {badge}
          </Text>
        ) : null}
        <Text style={{ flex: 1, color: colors.txPrimary, fontSize: 14, fontWeight: '600' }}>
          {title}
        </Text>
        {rightLabel ? (
          <Text style={{ color: colors.txTertiary, fontSize: 11, marginRight: 8 }}>{rightLabel}</Text>
        ) : null}
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={18} color={colors.txTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View>
      )}
    </View>
  );
}
