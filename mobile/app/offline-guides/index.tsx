/**
 * 오프라인 가이드 목록 — GET /offline-guides
 * 온라인이면 카탈로그, 오프라인이면 다운로드된 가이드만 노출.
 * 각 항목에 다운로드/업데이트 상태 표시.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { tapMedium } from '@/lib/haptics';
import { getCachedGuide, getCachedVersions } from '@/lib/local-offline-guides';
import { useSettings } from '@/lib/settings-context';
import type { OfflineGuideListItem } from '@/lib/types';

export default function OfflineGuidesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guides, setGuides] = useState<OfflineGuideListItem[]>([]);
  const [cached, setCached] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const versions = await getCachedVersions();
    setCached(versions);
    try {
      // 온라인: 서버 카탈로그
      setGuides(await api.offlineGuides.list());
    } catch {
      // 오프라인: 캐시된 가이드만 구성
      const ids = Object.keys(versions).map(Number);
      const items: OfflineGuideListItem[] = [];
      for (const id of ids) {
        const g = await getCachedGuide(id);
        if (g) {
          const { sections: _omit, ...meta } = g;
          items.push(meta);
        }
      }
      setGuides(items);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tapMedium();
    await load();
    setRefreshing(false);
  }, [load]);

  // 상세에서 다운로드 후 돌아오면 상태 갱신
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function downloadState(g: OfflineGuideListItem): 'none' | 'downloaded' | 'update' {
    const v = cached[g.id];
    if (v === undefined) return 'none';
    return v < g.version ? 'update' : 'downloaded';
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
          {lang === 'ko' ? '오프라인 가이드' : 'Offline Guides'}
        </Text>
      </View>

      {loading ? (
        <ListSkeleton count={5} />
      ) : (
        <FlatList
          data={guides}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.coral500} colors={[palette.coral500]} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📕</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '가이드가 없어요.' : 'No guides yet.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const st = downloadState(item);
            return (
              <PressableScale
                onPress={() => router.push(`/offline-guides/${item.id}`)}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.lineDefault,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ color: colors.txTertiary, fontSize: 12 }}>
                    {item.city}{item.country ? ` · ${item.country}` : ''}
                  </Text>
                  {st === 'downloaded' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                      <Ionicons name="checkmark-circle" size={13} color="#27AE60" />
                      <Text style={{ color: '#27AE60', fontSize: 11, fontWeight: '600' }}>
                        {lang === 'ko' ? '다운로드됨' : 'Downloaded'}
                      </Text>
                    </View>
                  )}
                  {st === 'update' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                      <Ionicons name="arrow-down-circle" size={13} color={palette.coral500} />
                      <Text style={{ color: palette.coral500, fontSize: 11, fontWeight: '600' }}>
                        {lang === 'ko' ? '업데이트' : 'Update'}
                      </Text>
                    </View>
                  )}
                  {st === 'none' && (
                    <Text style={{ color: colors.txTertiary, fontSize: 11, marginLeft: 'auto' }}>
                      {item.file_size_kb} KB
                    </Text>
                  )}
                </View>
                <Text style={{ color: colors.txPrimary, fontSize: 16, fontWeight: '700' }}>{item.title}</Text>
                {!!item.summary && (
                  <Text style={{ color: colors.txSecondary, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                    {item.summary}
                  </Text>
                )}
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}
