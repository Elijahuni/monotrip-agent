import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  style?: ViewStyle;
}

const roundedMap: Record<NonNullable<SkeletonProps['rounded']>, number> = {
  none: 0, sm: 6, md: 8, lg: 12, xl: 16, full: 9999,
};

/**
 * Shimmer 로딩 스켈레톤.
 * - reanimated로 opacity를 0.5↔1로 반복.
 * - width/height/rounded 자유 지정.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = 'md',
  className = '',
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`bg-bg-strong ${className}`}
      style={[
        { width, height, borderRadius: roundedMap[rounded] },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** 여러 줄 텍스트 스켈레톤 */
export function SkeletonLines({ lines = 2, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}
