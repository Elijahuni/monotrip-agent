import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { palette } from '@/lib/design-tokens';
import type { NearbyPlace } from '@/lib/geocoding';

const CATEGORY_ICONS: Record<string, string> = {
  숙소: '🏨', 음식점: '🍜', 관광지: '🗺️',
  카페: '☕', 쇼핑: '🛍️', 자연: '🌿',
  문화: '🏛️', 엔터테인먼트: '🎭', 액티비티: '🎢',
};

function categoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? '📍';
}

interface NearbyCardProps {
  place: NearbyPlace;
  isDark: boolean;
  onSave: (p: NearbyPlace) => void;
  saving: boolean;
}

export function NearbyCard({ place, isDark, onSave, saving }: NearbyCardProps) {
  const txP = isDark ? '#E8EDF2' : '#1A2E44';
  const txT = isDark ? '#6B7785' : '#9BA7B5';
  const bg  = isDark ? '#161622' : '#FFFFFF';
  const brd = isDark ? '#2A2A3E' : '#E8ECF2';
  const stars = place.rating != null ? '⭐ ' + place.rating.toFixed(1) : '';
  const openLabel = place.open_now === true ? '영업 중' : place.open_now === false ? '영업 종료' : '';
  const openColor = place.open_now === true ? '#27AE60' : '#E74C3C';

  return (
    <View style={{
      backgroundColor: bg, borderRadius: 16, borderWidth: 1, borderColor: brd,
      marginBottom: 12, padding: 14,
      shadowColor: isDark ? '#000' : '#1A2E44',
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(place.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: txP, fontSize: 15, fontWeight: '700', lineHeight: 20 }} numberOfLines={1}>{place.name}</Text>
          <Text style={{ color: txT, fontSize: 12, marginTop: 2 }} numberOfLines={1}>📍 {place.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: isDark ? '#9BA7B5' : '#FF5A5F', fontSize: 11, fontWeight: '600' }}>{place.category}</Text>
            </View>
            {stars ? (
              <View style={{ backgroundColor: isDark ? '#2A2A1A' : '#FFFDE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#F39C12', fontSize: 11, fontWeight: '700' }}>{stars}</Text>
              </View>
            ) : null}
            {openLabel ? (
              <View style={{ backgroundColor: isDark ? (place.open_now ? '#0D2A1A' : '#2A0D0D') : (place.open_now ? '#EAFAF1' : '#FDECEA'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: openColor, fontSize: 11, fontWeight: '600' }}>{openLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSave(place)}
        disabled={saving}
        style={{
          marginTop: 12, borderRadius: 10, paddingVertical: 10,
          backgroundColor: saving ? (isDark ? '#1E1E2E' : '#F0F4F8') : palette.coral500,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
        }}
        activeOpacity={0.8}>
        {saving
          ? <ActivityIndicator color={isDark ? '#6B7785' : '#9BA7B5'} size="small" />
          : <>
              <Ionicons name="heart-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>보관함에 저장</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}
