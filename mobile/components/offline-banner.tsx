import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface OfflineBannerProps {
  isOnline: boolean;
}

/**
 * 네트워크 오프라인 상태일 때 화면 상단에 표시되는 배너.
 * 온/오프라인 전환 시 페이드 인/아웃 애니메이션.
 */
export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const opacity = useRef(new Animated.Value(isOnline ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOnline ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline]);

  // 온라인이고 opacity가 0이면 아무것도 렌더링하지 않음 (레이아웃 공간 차지 방지)
  if (isOnline) {
    return (
      <Animated.View style={{ opacity, overflow: 'hidden' }}>
        <View className="bg-tx-secondary py-1.5 px-4 flex-row items-center justify-center gap-2">
          <Text className="text-tx-inverse text-xs font-semibold">
            ✓ 다시 연결되었습니다
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ opacity }}>
      <View className="bg-tx-secondary py-1.5 px-4 flex-row items-center justify-center gap-2">
        <View className="w-1.5 h-1.5 rounded-full bg-state-danger" />
        <Text className="text-tx-inverse text-xs font-semibold">
          오프라인 • 로컬 데이터 표시 중
        </Text>
      </View>
    </Animated.View>
  );
}
