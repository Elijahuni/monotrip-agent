import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { palette } from '@/lib/design-tokens';
import { categoryEmoji } from '@/lib/trip-utils';
import type { Location } from '@/lib/types';

interface RichLocationCardProps {
  loc: Location;
  isDark: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** 다른 사용자가 방금 변경 → 잠시 강조 표시 */
  highlighted?: boolean;
}

export function RichLocationCard({
  loc, isDark, onDelete, onEdit, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  highlighted = false,
}: RichLocationCardProps) {
  const bgS  = isDark ? '#141420' : '#FFFFFF';
  const txP  = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc = isDark ? '#9BA7B5' : '#5A6474';
  const bord = highlighted ? palette.coral500 : (isDark ? '#2A2A3E' : '#E8ECF2');
  const stars = loc.rating
    ? '★'.repeat(Math.round(loc.rating)) + '☆'.repeat(5 - Math.round(loc.rating))
    : null;
  const images = loc.images ?? [];

  return (
    <View style={[S.locCard, { backgroundColor: bgS, borderColor: bord, borderWidth: highlighted ? 2 : 1 }]}>
      {/* 순서 배지 + 이동 */}
      <View style={{ alignItems: 'center', gap: 4, marginTop: 2 }}>
        <TouchableOpacity onPress={onMoveUp} disabled={!canMoveUp}
          style={{ opacity: canMoveUp ? 1 : 0.2, padding: 2 }}>
          <Ionicons name="chevron-up" size={14} color={palette.coral500} />
        </TouchableOpacity>
        <View style={S.orderBadge}>
          <Text style={S.orderTx}>{loc.visit_order}</Text>
        </View>
        <TouchableOpacity onPress={onMoveDown} disabled={!canMoveDown}
          style={{ opacity: canMoveDown ? 1 : 0.2, padding: 2 }}>
          <Ionicons name="chevron-down" size={14} color={palette.coral500} />
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18 }}>{categoryEmoji(loc.category)}</Text>
          <Text style={[S.locName, { color: txP }]} numberOfLines={1}>{loc.name}</Text>
        </View>
        <Text style={[S.locAddr, { color: txSc }]} numberOfLines={1}>{loc.address}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {stars && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#FFF8E1' }]}>
              <Text style={{ color: '#F39C12', fontSize: 11 }}>{stars}</Text>
            </View>
          )}
          {loc.estimated_minutes != null && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0' }]}>
              <Ionicons name="time-outline" size={11} color={palette.coral500} />
              <Text style={{ color: palette.coral500, fontSize: 11, marginLeft: 3 }}>
                {loc.estimated_minutes >= 60
                  ? `${Math.floor(loc.estimated_minutes / 60)}h${loc.estimated_minutes % 60 > 0 ? ` ${loc.estimated_minutes % 60}m` : ''}`
                  : `${loc.estimated_minutes}m`}
              </Text>
            </View>
          )}
          {loc.budget_per_person != null && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#EAFAF1' }]}>
              <Text style={{ color: '#27AE60', fontSize: 11 }}>₩{loc.budget_per_person.toLocaleString()}</Text>
            </View>
          )}
        </View>
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {images.slice(0, 4).map((u, i) => (
                <ExpoImage key={u + i} source={{ uri: u }} style={{ width: 56, height: 56, borderRadius: 8 }} contentFit="cover" transition={150} />
              ))}
              {images.length > 4 && (
                <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: bord, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: txSc, fontSize: 11, fontWeight: '700' }}>+{images.length - 4}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
        {loc.notes ? (
          <Text style={[S.locNotes, { color: txSc }]} numberOfLines={2}>{loc.notes}</Text>
        ) : null}
      </View>

      {/* 편집 / 삭제 */}
      <View style={{ gap: 8, justifyContent: 'center' }}>
        <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
          <Ionicons name="pencil-outline" size={16} color={palette.coral500} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={16} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  locCard:    { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, alignItems: 'flex-start' },
  orderBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.coral500, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  orderTx:    { color: '#fff', fontWeight: '800', fontSize: 12 },
  locName:    { fontSize: 15, fontWeight: '700', flex: 1 },
  locAddr:    { fontSize: 12, marginTop: 2 },
  locNotes:   { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  badge:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
