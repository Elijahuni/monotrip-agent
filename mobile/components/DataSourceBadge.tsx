/**
 * 메타서치 결과의 데이터 출처 표시 배지.
 * - "mock": 시뮬레이션 가격 (참고용) — 노란색 경고
 * - "live": 실제 어필리에이트 API 가격 — 표시 안 함 (정상이므로)
 *
 * 의도: 베타 사용자가 Mock 가격을 실제 가격으로 오인하지 않도록 명시.
 */
import { Text, View } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';
import type { DataSource } from '@/lib/types';

export function DataSourceBadge({ source }: { source: DataSource | undefined }) {
  const colors = useThemedColors();
  if (source !== 'mock') return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#FFF7E6',
        borderWidth: 1,
        borderColor: '#FFD591',
      }}
      accessibilityRole="text"
      accessibilityLabel="시뮬레이션 가격 안내">
      <Text style={{ fontSize: 14 }}>⚠️</Text>
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#874D00' }}>
        참고용 시뮬레이션 가격이에요. 실제 예약 페이지에서 정확한 가격을 확인해주세요.
      </Text>
    </View>
  );
}
