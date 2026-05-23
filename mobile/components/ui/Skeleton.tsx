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

/** 카드 한 장 형태의 스켈레톤 (리스트 아이템 모양) */
export function SkeletonCard() {
  return (
    <View
      className="bg-bg-surface border border-line-default"
      style={{ borderRadius: 12, padding: 16, marginBottom: 10 }}
    >
      <Skeleton height={12} width="40%" rounded="sm" />
      <View style={{ height: 10 }} />
      <Skeleton height={16} width="80%" />
      <View style={{ height: 8 }} />
      <SkeletonLines lines={2} />
    </View>
  );
}

/**
 * 리스트 로딩 스켈레톤 — 스피너 대신 콘텐츠 모양으로 N개 카드 표시.
 * 신규 목록 화면(공지·FAQ·쿠폰·가이드·투어·렌터카)의 로딩 상태에 사용.
 */
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
