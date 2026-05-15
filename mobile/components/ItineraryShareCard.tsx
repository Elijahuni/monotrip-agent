/**
 * 일정 이미지 공유 카드 (U4)
 *
 * 사용법:
 *   const ref = useRef<ItineraryShareCardRef>(null);
 *   await ref.current?.capture(); // → URI 반환 후 Share.share()
 *
 * react-native-view-shot으로 카드를 스크린샷 → 네이티브 Share 시트.
 * 화면에 직접 표시할 때는 visible prop을 true로, 숨길 때는 false로.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';

import { palette } from '@/lib/design-tokens';
import type { Location, Trip } from '@/lib/types';

export interface ItineraryShareCardRef {
  /** 카드를 캡처하고 네이티브 공유 시트를 열어준다. */
  shareAsImage(): Promise<void>;
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    '관광지': '🏛️', '음식점': '🍜', '숙소': '🏨',
    '카페': '☕', '쇼핑': '🛍️', '자연': '🌿',
    '문화': '🎭', '액티비티': '🎢',
  };
  return map[cat] ?? '📍';
}

function groupByDay(locs: Location[]): Array<{ day: number; items: Location[] }> {
  const map = new Map<number, Location[]>();
  for (const l of locs) {
    const d = l.day_index ?? 1;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(l);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => ({ day, items: items.sort((a, b) => a.visit_order - b.visit_order) }));
}

interface Props {
  trip: Trip;
  locations: Location[];
}

export const ItineraryShareCard = forwardRef<ItineraryShareCardRef, Props>(
  function ItineraryShareCard({ trip, locations }, ref) {
    const viewRef = useRef<ViewShotRef>(null);

    useImperativeHandle(ref, () => ({
      async shareAsImage() {
        if (!viewRef.current) return;
        try {
          const uri = await captureRef(viewRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          });
          await Share.share({
            url: uri,               // iOS
            message: `${trip.title} ✈️ | 모노트립`,  // Android
          });
        } catch {
          // 사용자가 취소하거나 캡처 실패 → 무시
        }
      },
    }));

    const groups = groupByDay(locations);

    return (
      /* 화면 밖에 숨겨서 렌더링 (캡처 전용) */
      <View style={s.offscreen} pointerEvents="none">
        <ViewShot ref={viewRef} style={s.card}>
          {/* 헤더 */}
          <View style={s.header}>
            <Text style={s.appName}>✈️ 모노트립</Text>
            <Text style={s.tripTitle} numberOfLines={2}>{trip.title}</Text>
            {(trip.start_date || trip.end_date) ? (
              <Text style={s.dateRange}>
                {trip.start_date ?? ''}{trip.end_date ? ` → ${trip.end_date}` : ''}
              </Text>
            ) : null}
          </View>

          {/* 일정 */}
          <View style={s.body}>
            {groups.slice(0, 5).map(({ day, items }) => (
              <View key={day} style={s.dayBlock}>
                <View style={s.dayBadge}>
                  <Text style={s.dayBadgeTx}>Day {day}</Text>
                </View>
                {items.slice(0, 6).map((loc) => (
                  <View key={loc.id} style={s.locRow}>
                    <Text style={s.locOrder}>{loc.visit_order}</Text>
                    <Text style={s.locEmoji}>{categoryEmoji(loc.category)}</Text>
                    <Text style={s.locName} numberOfLines={1}>{loc.name}</Text>
                  </View>
                ))}
                {items.length > 6 && (
                  <Text style={s.more}>+{items.length - 6}개 더</Text>
                )}
              </View>
            ))}
            {groups.length > 5 && (
              <Text style={s.more}>Day {groups[5].day}~ {groups.length - 5}일 더 ...</Text>
            )}
          </View>

          {/* 푸터 */}
          <View style={s.footer}>
            <Text style={s.footerTx}>모노트립 앱으로 만든 여행 일정</Text>
          </View>
        </ViewShot>
      </View>
    );
  },
);

const CARD_W = 360;

const s = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: CARD_W,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: palette.coral500,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  appName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 1,
  },
  tripTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  dateRange: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 12,
    marginTop: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  dayBlock: {
    gap: 6,
  },
  dayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  dayBadgeTx: {
    color: palette.coral600,
    fontSize: 11,
    fontWeight: '700',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  locOrder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  locEmoji: {
    fontSize: 14,
  },
  locName: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  more: {
    fontSize: 11,
    color: '#9BA7B5',
    paddingLeft: 30,
  },
  footer: {
    backgroundColor: '#F7F9FC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF2',
  },
  footerTx: {
    fontSize: 11,
    color: '#9BA7B5',
    textAlign: 'center',
  },
});
