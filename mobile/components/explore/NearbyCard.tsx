import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { palette, shadow, useThemedColors } from '@/lib/design-tokens';
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

export function NearbyCard({ place, isDark: _isDark, onSave, saving }: NearbyCardProps) {
  const colors = useThemedColors();
  const cardShadow = { ...shadow.card, shadowColor: colors.shadowColor };
  const stars = place.rating != null ? '⭐ ' + place.rating.toFixed(1) : '';
  const openLabel = place.open_now === true ? '영업 중' : place.open_now === false ? '영업 종료' : '';
  const openColor = place.open_now === true ? '#10B981' : colors.txDanger;

  return (
    <View style={{
      backgroundColor: colors.bgSurface, borderRadius: 16, borderWidth: 1, borderColor: colors.lineDefault,
      marginBottom: 12, padding: 14, ...cardShadow,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: colors.bgSubtle,
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(place.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.txPrimary, fontSize: 15, fontWeight: '700', lineHeight: 20 }} numberOfLines={1}>{place.name}</Text>
          <Text style={{ color: colors.txTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>📍 {place.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: colors.bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: colors.brandPrimary, fontSize: 11, fontWeight: '600' }}>{place.category}</Text>
            </View>
            {stars ? (
              <View style={{ backgroundColor: colors.bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>{stars}</Text>
              </View>
            ) : null}
            {openLabel ? (
              <View style={{ backgroundColor: colors.bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
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
          backgroundColor: saving ? colors.bgSubtle : palette.coral500,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
        }}
        activeOpacity={0.8}>
        {saving
          ? <ActivityIndicator color={colors.txTertiary} size="small" />
          : <>
              <Ionicons name="heart-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>보관함에 저장</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}
