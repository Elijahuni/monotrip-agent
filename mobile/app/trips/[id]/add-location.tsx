import { AxiosError } from 'axios';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, type LatLng, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceSearchInput } from '@/components/PlaceSearchInput';
import { Button, Chip, SegmentedControl, TextField } from '@/components/ui';
import { CATEGORIES, categoryIcon } from '@/lib/categories';
import { palette } from '@/lib/design-tokens';
import { useCreateLocation, useTrip } from '@/lib/queries';
import type { PlaceSearchResult } from '@/lib/schemas';

type Mode = 'search' | 'map' | 'nearby';

const MODE_OPTIONS = [
  { value: 'search' as const, label: '검색', icon: '🔎' },
  { value: 'map' as const, label: '지도', icon: '🗺️' },
  { value: 'nearby' as const, label: '내 주변', icon: '📍' },
];

/**
 * 장소 추가 풀스크린 라우트.
 * 3가지 입력 모드:
 *   - 검색: Google Places API 디바운스 자동완성
 *   - 지도: 지도에서 핀 선택 (역지오코딩으로 주소 자동 채움)
 *   - 내 주변: 현재 위치 기반 주변 추천
 */
export default function AddLocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tripQuery = useTrip(tripId, !Number.isNaN(tripId));
  const createLocation = useCreateLocation();

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PlaceSearchResult | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES[2]);
  const [notes, setNotes] = useState('');

  // 현재 위치 — 지도/내 주변 모드에서 사용
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );

  const trip = tripQuery.data ?? null;
  const nextOrder = (trip?.locations?.length ?? 0) + 1;

  // 위치 편향 기준 — 사용자 위치 우선, 없으면 현재 trip의 첫 장소
  const nearBias = userLocation ?? (() => {
    const firstValid = trip?.locations?.find((l) => l.latitude !== 0 && l.longitude !== 0);
    return firstValid ? { latitude: firstValid.latitude, longitude: firstValid.longitude } : null;
  })();

  // ── 위치 권한 요청 ─────────────────────────────────────────────────────────
  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationPermission('denied');
      return null;
    }
    setLocationPermission('granted');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setUserLocation(coords);
    return coords;
  }, []);

  // 지도/내 주변 모드 전환 시 권한이 없으면 요청
  useEffect(() => {
    if ((mode === 'map' || mode === 'nearby') && locationPermission === 'unknown') {
      requestLocation().catch(() => {/* 사용자가 거부해도 지도 기본 위치로 진행 */});
    }
  }, [mode, locationPermission, requestLocation]);

  // ── 저장 ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selected) return;
    try {
      await createLocation.mutateAsync({
        tripId,
        body: {
          name: selected.name,
          address: selected.address,
          latitude: selected.latitude,
          longitude: selected.longitude,
          category,
          visit_order: nextOrder,
          notes: notes.trim() || null,
        },
      });
      router.back();
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '장소 추가에 실패했습니다.')
        : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    }
  }

  function handleSelectPlace(place: PlaceSearchResult) {
    setSelected(place);
    setCategory(place.category);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── 헤더 ── */}
      <View
        className="bg-bg-surface px-4 pb-3 border-b border-line-default"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="p-1">
            <Text className="text-tx-brand text-sm font-semibold">← 취소</Text>
          </TouchableOpacity>
          <Text className="text-base font-bold text-tx-primary">장소 추가</Text>
          <View style={{ width: 50 }} />
        </View>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </View>

      {/* ── 본문 ── */}
      <View className="flex-1 px-4 pt-4">
        {mode === 'search' && (
          <PlaceSearchInput
            query={query}
            onQueryChange={setQuery}
            onSelect={handleSelectPlace}
            near={nearBias}
          />
        )}

        {mode === 'map' && (
          <MapPickerBody
            initial={userLocation ?? nearBias ?? undefined}
            permission={locationPermission}
            onRequestPermission={requestLocation}
            onSelect={handleSelectPlace}
          />
        )}

        {mode === 'nearby' && (
          <NearbyBody
            location={userLocation}
            permission={locationPermission}
            onRequestPermission={requestLocation}
            onSelect={handleSelectPlace}
          />
        )}
      </View>

      {/* ── 선택된 장소 + 카테고리/메모/저장 ── */}
      {selected && <SelectedFooter
        place={selected}
        category={category}
        onCategoryChange={setCategory}
        notes={notes}
        onNotesChange={setNotes}
        onClear={() => setSelected(null)}
        onSave={handleSave}
        saving={createLocation.isPending}
        bottomInset={insets.bottom}
      />}
    </KeyboardAvoidingView>
  );
}

// ─── 지도 모드 ─────────────────────────────────────────────────────────────────

function MapPickerBody({
  initial,
  permission,
  onRequestPermission,
  onSelect,
}: {
  initial?: { latitude: number; longitude: number };
  permission: 'unknown' | 'granted' | 'denied';
  onRequestPermission: () => Promise<{ latitude: number; longitude: number } | null>;
  onSelect: (place: PlaceSearchResult) => void;
}) {
  // 기본 위치: 서울 시청
  const defaultRegion: Region = {
    latitude: initial?.latitude ?? 37.5665,
    longitude: initial?.longitude ?? 126.9780,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);

  function dropPin(coordinate: LatLng) {
    setPin(coordinate);
  }

  async function handleConfirm() {
    if (!pin) return;
    setReverseLoading(true);
    try {
      // expo-location 역지오코딩 (네트워크 + iOS는 시스템 API 사용)
      const results = await Location.reverseGeocodeAsync(pin);
      const first = results[0];
      const addressParts = [first?.country, first?.region, first?.city, first?.street, first?.name]
        .filter(Boolean)
        .join(' ');
      const name = first?.name || first?.street || '선택한 위치';

      onSelect({
        place_id: `map-${pin.latitude}-${pin.longitude}`,
        name,
        address: addressParts || '주소 미상',
        latitude: pin.latitude,
        longitude: pin.longitude,
        category: '관광지',
        photo_url: null,
        rating: null,
        user_ratings_total: null,
      });
    } catch {
      // 역지오코딩 실패 시에도 좌표는 그대로 사용
      onSelect({
        place_id: `map-${pin.latitude}-${pin.longitude}`,
        name: '선택한 위치',
        address: `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`,
        latitude: pin.latitude,
        longitude: pin.longitude,
        category: '관광지',
        photo_url: null,
        rating: null,
        user_ratings_total: null,
      });
    } finally {
      setReverseLoading(false);
    }
  }

  return (
    <View className="flex-1">
      {permission === 'denied' && (
        <View className="px-3 py-2 bg-bg-subtle rounded-lg mb-2">
          <Text className="text-xs text-tx-secondary">
            위치 권한이 없어 현재 위치를 표시할 수 없어요. 지도를 직접 이동해 주세요.
          </Text>
        </View>
      )}

      <View className="flex-1 rounded-2xl overflow-hidden border border-line-default">
        <MapView
          style={{ flex: 1 }}
          initialRegion={defaultRegion}
          onPress={(e) => dropPin(e.nativeEvent.coordinate)}
          onLongPress={(e) => dropPin(e.nativeEvent.coordinate)}
          showsUserLocation={permission === 'granted'}>
          {pin && <Marker coordinate={pin} pinColor={palette.coral500} />}
        </MapView>
      </View>

      <Text className="text-xs text-tx-tertiary text-center mt-2">
        지도를 탭하거나 길게 눌러 위치를 선택하세요
      </Text>

      <View className="mt-3">
        <Button
          label={pin ? '이 위치 선택' : '먼저 지도에서 위치를 선택해주세요'}
          onPress={handleConfirm}
          loading={reverseLoading}
          disabled={!pin}
        />
      </View>
    </View>
  );
}

// ─── 내 주변 모드 ──────────────────────────────────────────────────────────────

function NearbyBody({
  location,
  permission,
  onRequestPermission,
  onSelect,
}: {
  location: { latitude: number; longitude: number } | null;
  permission: 'unknown' | 'granted' | 'denied';
  onRequestPermission: () => Promise<{ latitude: number; longitude: number } | null>;
  onSelect: (place: PlaceSearchResult) => void;
}) {
  const [query, setQuery] = useState('맛집');

  if (permission === 'denied') {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-4xl">📍</Text>
        <Text className="text-base font-bold text-tx-primary">위치 권한이 필요해요</Text>
        <Text className="text-sm text-tx-tertiary text-center leading-relaxed">
          현재 위치 기반 추천을 받으려면{'\n'}위치 권한을 허용해주세요
        </Text>
        <View className="mt-2 w-full">
          <Button label="위치 권한 요청" onPress={onRequestPermission} size="md" />
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <ActivityIndicator color={palette.coral500} />
        <Text className="text-sm text-tx-tertiary mt-2">현재 위치 확인 중...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row gap-2 mb-3">
        {['맛집', '카페', '관광지', '쇼핑', '편의시설'].map((preset) => (
          <Chip
            key={preset}
            label={preset}
            selected={query === preset}
            onPress={() => setQuery(preset)}
            size="sm"
          />
        ))}
      </View>
      <PlaceSearchInput
        query={query}
        onQueryChange={setQuery}
        onSelect={onSelect}
        near={location}
      />
    </View>
  );
}

// ─── 선택된 장소 푸터 (모드 공통) ──────────────────────────────────────────────

function SelectedFooter({
  place,
  category,
  onCategoryChange,
  notes,
  onNotesChange,
  onClear,
  onSave,
  saving,
  bottomInset,
}: {
  place: PlaceSearchResult;
  category: string;
  onCategoryChange: (c: string) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  onClear: () => void;
  onSave: () => void;
  saving: boolean;
  bottomInset: number;
}) {
  return (
    <View
      className="bg-bg-surface border-t border-line-default px-4 pt-3"
      style={{ paddingBottom: Math.max(bottomInset, 12) }}>
      {/* 선택된 장소 미리보기 */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 rounded-full bg-brand-primary items-center justify-center">
          <Text className="text-tx-inverse text-base">{categoryIcon(category)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-tx-primary" numberOfLines={1}>
            {place.name}
          </Text>
          <Text className="text-xs text-tx-tertiary" numberOfLines={1}>{place.address}</Text>
        </View>
        <TouchableOpacity onPress={onClear} className="p-1" activeOpacity={0.7}>
          <Text className="text-tx-tertiary text-base">✕</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 칩 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
        {CATEGORIES.map((cat) => (
          <View key={cat} className="mx-1">
            <Chip
              label={`${categoryIcon(cat)} ${cat}`}
              selected={category === cat}
              onPress={() => onCategoryChange(cat)}
              size="sm"
            />
          </View>
        ))}
      </ScrollView>

      <TextField
        placeholder="메모 (선택)"
        value={notes}
        onChangeText={onNotesChange}
        multiline
        numberOfLines={2}
        containerClassName="mb-3"
      />

      <Button label="이 장소 추가" onPress={onSave} loading={saving} />
    </View>
  );
}
