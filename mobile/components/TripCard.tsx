import { Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { Trip } from '@/lib/types';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
  onLongPress?: () => void;
}

/** 'YYYY-MM-DD' → Date (시차 보정 없이 로컬 자정 기준) */
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) {
    const [, sm, sd] = start.split('-');
    const [, em, ed] = end.split('-');
    return `${sm}.${sd} – ${em}.${ed}`;
  }
  if (start) {
    const [, sm, sd] = start.split('-');
    return `${sm}.${sd}부터`;
  }
  return '날짜 미정';
}

/**
 * 출발일 기준 D-day 라벨.
 * - 미래: "D-N"
 * - 당일: "D-DAY"
 * - 진행 중: "여행 중"
 * - 완료: "완료"
 * - 날짜 미정: null
 */
function dDayLabel(start: string | null, end: string | null): string | null {
  const s = parseDate(start);
  if (!s) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffStart = Math.round((s.getTime() - today.getTime()) / 86400000);

  if (diffStart > 0) return `D-${diffStart}`;
  if (diffStart === 0) return 'D-DAY';
  const e = parseDate(end);
  if (e) {
    const diffEnd = Math.round((e.getTime() - today.getTime()) / 86400000);
    if (diffEnd >= 0) return '여행 중';
    return '완료';
  }
  return '진행됨';
}

function dDayColor(label: string | null): string {
  if (label === 'D-DAY' || label === '여행 중') return 'bg-brand-secondary';
  if (label === '완료' || label === '진행됨') return 'bg-bg-strong';
  return 'bg-brand-primary';
}

function dDayTextColor(label: string | null): string {
  if (label === '완료' || label === '진행됨') return 'text-tx-tertiary';
  return 'text-tx-inverse';
}

/**
 * 트립 카드 — 홈 화면의 메인 컴포넌트.
 * - 좌측 그라데이션 strip + 우상단 D-day 뱃지
 * - 제목, 기간, 설명
 */
export function TripCard({ trip, onPress, onLongPress }: TripCardProps) {
  const dLabel = dDayLabel(trip.start_date, trip.end_date);
  const dBg = dDayColor(dLabel);
  const dTx = dDayTextColor(dLabel);

  return (
    <View className="mx-4 mb-3">
      <Card elevation="sm" padding="none" onPress={onPress} onLongPress={onLongPress}>
        {/* 좌측 컬러 strip (그라데이션 대용 — 단색 + 보조색 점) */}
        <View className="flex-row">
          <View className="w-1.5 bg-brand-primary" />
          <View className="flex-1 px-4 py-4">
            {/* 타이틀 + D-day */}
            <View className="flex-row items-start justify-between gap-2 mb-2">
              <Text className="flex-1 text-base font-bold text-tx-primary" numberOfLines={1}>
                {trip.title}
              </Text>
              {dLabel ? (
                <View className={`${dBg} px-2 py-0.5 rounded-md`}>
                  <Text className={`${dTx} text-[11px] font-bold tracking-wide`}>{dLabel}</Text>
                </View>
              ) : null}
            </View>

            {/* 기간 */}
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs text-tx-tertiary">🗓</Text>
              <Text className="text-xs text-tx-tertiary">
                {formatDateRange(trip.start_date, trip.end_date)}
              </Text>
            </View>

            {/* 설명 */}
            {trip.description ? (
              <Text
                className="text-sm text-tx-secondary mt-2 leading-relaxed"
                numberOfLines={2}>
                {trip.description}
              </Text>
            ) : null}

            {/* CTA */}
            <View className="flex-row justify-end mt-3">
              <Text className="text-xs text-tx-brand font-semibold">자세히 보기 ›</Text>
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}

/** 트립 카드 스켈레톤 — 로딩 시 자리 차지용 */
export { TripCardSkeleton } from './TripCardSkeleton';
