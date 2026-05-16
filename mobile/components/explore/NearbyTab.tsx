import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '@/lib/design-tokens';
import type { NearbyPlace } from '@/lib/geocoding';
import type { ExploreTheme } from './AiRecommendTab';
import type { createTranslator } from '@/lib/i18n';
import { NearbyCard } from './NearbyCard';

const NEARBY_CATS = [
  { label: '전체',   type: '',                 emoji: '🗺️' },
  { label: '맛집',   type: 'restaurant',       emoji: '🍜' },
  { label: '카페',   type: 'cafe',             emoji: '☕' },
  { label: '관광지', type: 'tourist_attraction',emoji: '🏛️' },
  { label: '쇼핑',   type: 'shopping_mall',    emoji: '🛍️' },
];

interface NearbyTabProps {
  theme: ExploreTheme;
  lang: string;
  t: ReturnType<typeof createTranslator>;
  insets: { bottom: number };
  nearbyLoading: boolean;
  nearbyPlaces: NearbyPlace[];
  nearbyCat: number;
  nearbyError: string;
  savingPlaceId: string | null;
  userLocation: { lat: number; lng: number } | null;
  onCatChange: (idx: number) => void;
  onRequestLocation: () => void;
  onRefresh: () => void;
  onSavePlace: (place: NearbyPlace) => void;
}

export function NearbyTab({
  theme, insets,
  nearbyLoading, nearbyPlaces, nearbyCat, nearbyError,
  savingPlaceId, userLocation,
  onCatChange, onRequestLocation, onRefresh, onSavePlace,
}: NearbyTabProps) {
  const { isDark, bgSubtle, txPri, txSec, borderC } = theme;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: borderC }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' }}>
        {NEARBY_CATS.map((cat, idx) => (
          <TouchableOpacity
            key={cat.label}
            onPress={() => onCatChange(idx)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
              backgroundColor: nearbyCat === idx ? palette.coral500 : bgSubtle,
              borderColor: nearbyCat === idx ? palette.coral500 : borderC,
            }}
            activeOpacity={0.8}>
            <Text style={{ color: nearbyCat === idx ? '#fff' : txSec, fontSize: 13, fontWeight: '700' }}>
              {cat.emoji} {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {nearbyLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={palette.coral500} />
          <Text style={{ color: txSec, fontSize: 14 }}>주변 장소를 불러오는 중…</Text>
        </View>
      )}

      {!nearbyLoading && nearbyError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 48 }}>📍</Text>
          <Text style={{ color: txPri, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
            {userLocation ? '장소를 불러오지 못했습니다' : '현재 위치가 필요해요'}
          </Text>
          <Text style={{ color: txSec, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{nearbyError}</Text>
          <TouchableOpacity
            onPress={onRequestLocation}
            style={{ backgroundColor: palette.coral500, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {userLocation ? '다시 시도' : '위치 권한 허용'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!nearbyLoading && !nearbyError && !userLocation && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 56 }}>📍</Text>
          <Text style={{ color: txPri, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>내 주변 장소 탐색</Text>
          <Text style={{ color: txSec, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            현재 위치 기반으로{'\n'}주변 맛집, 카페, 관광지를 찾아드려요
          </Text>
          <TouchableOpacity
            onPress={onRequestLocation}
            style={{ backgroundColor: palette.coral500, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
            activeOpacity={0.85}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>📍 내 위치로 탐색 시작</Text>
          </TouchableOpacity>
        </View>
      )}

      {!nearbyLoading && !nearbyError && nearbyPlaces.length === 0 && userLocation && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={{ color: txSec, fontSize: 14 }}>주변에 장소가 없어요</Text>
        </View>
      )}

      {!nearbyLoading && nearbyPlaces.length > 0 && (
        <FlatList
          data={nearbyPlaces}
          keyExtractor={(item) => item.place_id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.coral500 }} />
              <Text style={{ color: txSec, fontSize: 13, fontWeight: '600' }}>내 주변 {nearbyPlaces.length}곳</Text>
              <TouchableOpacity
                onPress={onRefresh}
                style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: bgSubtle, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Ionicons name="refresh" size={12} color={txSec} />
                <Text style={{ color: txSec, fontSize: 12, fontWeight: '600' }}>새로고침</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <NearbyCard
              place={item} isDark={isDark}
              onSave={onSavePlace}
              saving={savingPlaceId === item.place_id}
            />
          )}
        />
      )}
    </View>
  );
}
