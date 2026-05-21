/**
 * 공지사항 목록 화면 — GET /notices
 * 고정 공지 우선, 카테고리 배지 표시, 탭 시 상세로 이동.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import type { NoticeCategory, NoticeListItem } from '@/lib/types';

const CATEGORY_META: Record<NoticeCategory, { ko: string; en: string; color: string }> = {
  general: { ko: '안내', en: 'Notice', color: '#5B8DEF' },
  event: { ko: '이벤트', en: 'Event', color: '#FF5A5F' },
  maintenance: { ko: '점검', en: 'Maintenance', color: '#E67E22' },
  update: { ko: '업데이트', en: 'Update', color: '#27AE60' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NoticesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<NoticeListItem[]>([]);

  const load = useCallback(async () => {
    try {
      setNotices(await api.notices.list({ limit: 50 }));
    } catch {
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          {lang === 'ko' ? '공지사항' : 'Notices'}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '등록된 공지가 없어요.' : 'No notices yet.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const meta = CATEGORY_META[item.category] ?? CATEGORY_META.general;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/notices/${item.id}`)}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.lineDefault,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  {item.is_pinned && (
                    <Ionicons name="pin" size={13} color={palette.coral500} />
                  )}
                  <View style={{ backgroundColor: meta.color, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                      {lang === 'ko' ? meta.ko : meta.en}
                    </Text>
                  </View>
                  <Text style={{ color: colors.txTertiary, fontSize: 11, marginLeft: 'auto' }}>
                    {formatDate(item.published_at)}
                  </Text>
                </View>
                <Text style={{ color: colors.txPrimary, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
