import { View } from 'react-native';

import { Card, Skeleton } from '@/components/ui';

export function TripCardSkeleton() {
  return (
    <View className="mx-4 mb-3">
      <Card elevation="sm" padding="none">
        <View className="flex-row">
          <View className="w-1.5 bg-bg-strong" />
          <View className="flex-1 px-4 py-4 gap-2">
            <Skeleton height={18} width="70%" />
            <Skeleton height={12} width="40%" />
            <Skeleton height={12} width="90%" />
            <Skeleton height={12} width="55%" />
          </View>
        </View>
      </Card>
    </View>
  );
}
