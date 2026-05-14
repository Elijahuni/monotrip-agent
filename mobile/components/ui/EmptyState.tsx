import { Text, View } from 'react-native';

import { Button } from './Button';

interface EmptyStateProps {
  /** 큰 이모지 또는 React 노드 (5.3에서 SVG 일러스트로 교체 예정) */
  icon?: string | React.ReactNode;
  title: string;
  description?: string;
  /** 선택적 CTA 버튼 */
  ctaLabel?: string;
  onCtaPress?: () => void;
  /** 컨테이너 추가 클래스 */
  className?: string;
}

export function EmptyState({
  icon = '✨',
  title,
  description,
  ctaLabel,
  onCtaPress,
  className = '',
}: EmptyStateProps) {
  return (
    <View className={`flex-1 items-center justify-center gap-3 px-8 pb-24 ${className}`}>
      <View className="w-24 h-24 rounded-full bg-bg-subtle items-center justify-center mb-2">
        {typeof icon === 'string' ? <Text className="text-5xl">{icon}</Text> : icon}
      </View>
      <Text className="text-lg font-bold text-tx-primary text-center">{title}</Text>
      {description ? (
        <Text className="text-sm text-tx-tertiary text-center leading-relaxed">{description}</Text>
      ) : null}
      {ctaLabel && onCtaPress ? (
        <View className="mt-4">
          <Button label={ctaLabel} onPress={onCtaPress} size="md" />
        </View>
      ) : null}
    </View>
  );
}
