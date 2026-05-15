/**
 * 공유된 여행 보기 화면
 * 딥링크: monotrip://share/{token} → /trips/shared/{token}
 * 비로그인 사용자도 접근 가능 (공개 읽기 전용)
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { palette } from '@/lib/design-tokens';
import type { Location, Trip } from '@/lib/types';

function categoryEmoji(cat: string) {
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
    const day = l.day_index ?? 1;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(l);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => ({ day, items: items.sort((a, b) => a.visit_order - b.visit_order) }));
}

export default function SharedTripScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [trip, setTrip]         = useState<Trip | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('공유 링크가 유효하지 않습니다.'); setLoading(false); return; }
    api.trips_share.getShared(token)
      .then(({ trip: t, locations: locs }) => {
        setTrip(t);
        setLocations(locs);
      })
      .catch((e: unknown) => {
        const status = e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
        if (status === 410) {
          setError('이 공유 링크는 만료되었습니다.');
        } else if (status === 404) {
          setError('공유된 여행을 찾을 수 없습니다.');
        } else {
          setError('여행 정보를 불러오지 못했습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const groups = groupByDay(locations);

  return (
    <View className="flex-1 bg-bg-base" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-line-default bg-bg-card">
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={palette.ink900} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-tx-primary" numberOfLines={1}>
            {loading ? '불러오는 중...' : (trip?.title ?? '공유된 여행')}
          </Text>
          <Text className="text-xs text-tx-tertiary mt-0.5">읽기 전용 공유 보기</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color={palette.coral500} />
          <Text className="text-sm text-tx-tertiary">여행 정보를 불러오는 중...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-5xl">🔗</Text>
          <Text className="text-base font-bold text-tx-primary text-center">{error}</Text>
          <TouchableOpacity
            className="bg-brand-primary px-6 py-3 rounded-xl mt-2"
            onPress={() => router.replace('/')}>
            <Text className="text-white text-sm font-semibold">홈으로 이동</Text>
          </TouchableOpacity>
        </View>
      ) : trip ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}>

          {/* 여행 요약 카드 */}
          <View className="bg-brand-primary rounded-2xl p-5 mb-4">
            <Text className="text-2xl font-bold text-white mb-1">{trip.title}</Text>
            {trip.description ? (
              <Text className="text-sm text-white/80 leading-relaxed">{trip.description}</Text>
            ) : null}
            {(trip.start_date || trip.end_date) && (
              <View className="flex-row items-center gap-2 mt-3">
                <Text className="text-white/70 text-xs">🗓</Text>
                <Text className="text-white/70 text-xs">
                  {trip.start_date ?? ''}{trip.end_date ? ` → ${trip.end_date}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* 일정 */}
          {groups.length === 0 ? (
            <View className="items-center py-12 gap-3">
              <Text className="text-5xl">🗺️</Text>
              <Text className="text-sm text-tx-tertiary">등록된 장소가 없습니다.</Text>
            </View>
          ) : (
            groups.map(({ day, items }) => (
              <View key={day} className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="bg-brand-primary/10 px-3 py-1 rounded-full">
                    <Text className="text-xs font-bold text-brand-primary">Day {day}</Text>
                  </View>
                  <Text className="text-xs text-tx-tertiary">{items.length}개 장소</Text>
                </View>

                {items.map((loc, i) => (
                  <View key={loc.id}>
                    <View className="flex-row items-start gap-3 bg-bg-card rounded-xl p-3 border border-line-default">
                      <View className="w-7 h-7 rounded-full bg-bg-subtle items-center justify-center mt-0.5">
                        <Text className="text-xs font-bold text-tx-secondary">{loc.visit_order}</Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 mb-0.5">
                          <Text className="text-sm">{categoryEmoji(loc.category)}</Text>
                          <Text className="text-sm font-semibold text-tx-primary flex-1" numberOfLines={1}>
                            {loc.name}
                          </Text>
                        </View>
                        <Text className="text-xs text-tx-tertiary" numberOfLines={1}>{loc.address}</Text>
                        {loc.notes ? (
                          <Text className="text-xs text-tx-secondary mt-1 leading-relaxed" numberOfLines={2}>
                            {loc.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {i < items.length - 1 && (
                      <View className="w-0.5 h-3 bg-line-default self-center" style={{ marginLeft: 27 }} />
                    )}
                  </View>
                ))}
              </View>
            ))
          )}

          <Text className="text-center text-xs text-tx-tertiary mt-4">
            모노트립으로 나만의 여행을 계획해보세요 ✈️
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
