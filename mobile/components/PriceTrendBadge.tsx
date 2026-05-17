/** 가격 추세 배지 — 검색 결과 상단에 노출. */
import { Text, View } from 'react-native';
import { useThemedColors } from '@/lib/design-tokens';
import type { PriceTrend } from '@/lib/types';

const SIGNAL_COLOR: Record<PriceTrend['signal'], string> = {
  buy_now: '#10B981',
  cheap: '#22C55E',
  average: '#6B7280',
  expensive: '#EF4444',
  insufficient_data: '#9CA3AF',
};

const SIGNAL_ICON: Record<PriceTrend['signal'], string> = {
  buy_now: '🔥',
  cheap: '↓',
  average: '→',
  expensive: '↑',
  insufficient_data: '📊',
};

export function PriceTrendBadge({ trend }: { trend: PriceTrend | null }) {
  const colors = useThemedColors();
  if (!trend) return null;
  const bg = SIGNAL_COLOR[trend.signal] ?? colors.bgSubtle;
  const icon = SIGNAL_ICON[trend.signal] ?? '📊';
  const isMuted = trend.signal === 'insufficient_data' || trend.signal === 'average';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: isMuted ? colors.bgSurface : bg,
        borderWidth: isMuted ? 1 : 0,
        borderColor: colors.lineDefault,
      }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: '700',
          color: isMuted ? colors.txSecondary : '#FFFFFF',
        }}>
        {trend.message}
      </Text>
      {trend.avg_7d ? (
        <Text style={{ fontSize: 11, color: isMuted ? colors.txTertiary : '#FFFFFF', opacity: 0.85 }}>
          7일 평균 ₩{trend.avg_7d.toLocaleString()}
        </Text>
      ) : null}
    </View>
  );
}
