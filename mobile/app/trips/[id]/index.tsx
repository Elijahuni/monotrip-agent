import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/LocationCard';
import { Button, EmptyState } from '@/components/ui';
import { palette, shadow, useThemedColors } from '@/lib/design-tokens';
import { useDeleteLocation, useDeleteTrip, useTrip } from '@/lib/queries';
import type { Location } from '@/lib/types';

const MAP_HEIGHT = 200;

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  return '날짜 미정';
}

// ─── 지도 ──────────────────────────────────────────────────────────────────────

function TripMap({ locations }: { locations: Location[] }) {
  const mapRef = useRef<MapView>(null);
  const colors = useThemedColors();
  const validLocs = locations.filter((l) => l.latitude !== 0 && l.longitude !== 0);

  function onMapReady() {
    if (validLocs.length === 0) return;
    if (validLocs.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: validLocs[0].latitude,
        longitude: validLocs[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 300);
      return;
    }
    mapRef.current?.fitToCoordinates(
      validLocs.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
      { edgePadding: { top: 32, right: 32, bottom: 32, left: 32 }, animated: true },
    );
  }

  if (validLocs.length === 0) return null;

  return (
    <View
      className="mx-4 mb-1 rounded-2xl overflow-hidden border border-line-default"
      style={{ height: MAP_HEIGHT }}>
      <MapView
        ref={mapRef}
        style={{ width: '100%', height: MAP_HEIGHT }}
        onMapReady={onMapReady}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}>
        {validLocs.map((loc, i) => (
          <Marker
            key={loc.id}
            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
            pinColor={palette.coral500}>
            <Callout>
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, maxWidth: 160 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.txPrimary }}>
                  {loc.visit_order || i + 1}. {loc.name}
                </Text>
                <Text style={{ fontSize: 10, color: colors.txTertiary, marginTop: 2 }} numberOfLines={1}>
                  {loc.category}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

// ─── 여행 상세 화면 ────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tripQuery = useTrip(tripId);
  const deleteTrip = useDeleteTrip();
  const deleteLocation = useDeleteLocation();

  const trip = tripQuery.data ?? null;
  const locations = (trip?.locations ?? []) as Location[];
  const loading = tripQuery.isPending;

  function handleDelete() {
    Alert.alert('여행 삭제', `"${trip?.title}" 여행을 삭제하시겠어요?\n장소 정보도 모두 사라집니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteTrip.mutate(tripId, {
            onSuccess: () => router.back(),
            onError: () => Alert.alert('오류', '여행 삭제에 실패했습니다.'),
          });
        },
      },
    ]);
  }

  function handleDeleteLocation(loc: Location) {
    deleteLocation.mutate(
      { tripId, locationId: loc.id },
      { onError: () => Alert.alert('오류', '장소 삭제에 실패했습니다.') },
    );
  }

  function goAddLocation() {
    router.push(`/trips/${tripId}/add-location` as never);
  }

  if (loading) {
    return (
      <View className="flex-1 bg-bg-surface items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={palette.coral500} />
        <Text className="text-tx-tertiary text-sm mt-3">여행 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon="🧭"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근 권한이 없습니다"
          ctaLabel="돌아가기"
          onCtaPress={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-3 pb-4 border-b border-line-default">
        <TouchableOpacity onPress={() => router.back()} className="mb-2 self-start" activeOpacity={0.7}>
          <Text className="text-tx-brand text-sm font-semibold">← 내 여행</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-tx-primary" numberOfLines={1}>{trip.title}</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5">
          {formatDateRange(trip.start_date, trip.end_date)}
        </Text>
        {trip.description ? (
          <Text className="text-sm text-tx-secondary mt-1.5 leading-relaxed" numberOfLines={2}>
            {trip.description}
          </Text>
        ) : null}
      </View>

      {/* ── 장소 목록 ── */}
      <FlatList
        data={locations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <LocationCard loc={item} index={index} onDelete={handleDeleteLocation} />
        )}
        ListHeaderComponent={
          <View>
            <View className="pt-4">
              <TripMap locations={locations} />
            </View>
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
              <View>
                <Text className="text-base font-bold text-tx-primary">방문 장소</Text>
                <Text className="text-xs text-tx-tertiary mt-0.5">총 {locations.length}곳</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="📍"
            title="장소가 없어요"
            description={'+ 버튼을 눌러\n방문할 장소를 추가해보세요'}
            ctaLabel="장소 추가하기"
            onCtaPress={goAddLocation}
          />
        }
        ListFooterComponent={
          <View style={{ paddingBottom: insets.bottom + 96 }}>
            <View className="mx-4 mt-6">
              <Button
                label="이 여행 삭제"
                variant="secondary"
                onPress={handleDelete}
                size="md"
              />
            </View>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        className="absolute right-5 w-14 h-14 rounded-full bg-brand-primary items-center justify-center"
        style={{ bottom: insets.bottom + 20, ...shadow.fab }}
        onPress={goAddLocation}
        activeOpacity={0.85}>
        <Text className="text-tx-inverse text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>
    </View>
  );
}
