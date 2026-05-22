/**
 * PressableScale — 누르면 살짝 축소되는 카드/버튼 래퍼.
 *
 * 최신 앱 특유의 "탭 반응" 마이크로 인터랙션. reanimated 스프링으로
 * pressIn 시 0.97 축소, pressOut 시 원복. 탭 시 가벼운 햅틱(옵션).
 */
import { ReactNode } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tapLight } from '@/lib/haptics';

interface PressableScaleProps {
  onPress?: () => void;
  /** pressIn 시 햅틱 (기본 true) */
  haptic?: boolean;
  /** 최소 축소 배율 (기본 0.97) */
  scaleTo?: number;
  disabled?: boolean;
  /** 스크린리더용 라벨 (카드 전체를 읽어줄 텍스트). 지정 시 role=button 자동. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}

export function PressableScale({
  onPress,
  haptic = true,
  scaleTo = 0.97,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  children,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        if (haptic) tapLight();
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
