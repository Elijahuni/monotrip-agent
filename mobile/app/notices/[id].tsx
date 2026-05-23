/**
 * 공지사항 상세 — GET /notices/{id}
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import type { NoticeCategory, NoticeDetail } from '@/lib/types';

const CATEGORY_LABEL: Record<NoticeCategory, { ko: string; en: string; color: string }> = {
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

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeDetail | null>(null);

  const load = useCallback(async () => {
    try {
      setNotice(await api.notices.get(Number(id)));
    } catch {
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = notice ? (CATEGORY_LABEL[notice.category] ?? CATEGORY_LABEL.general) : null;

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
          {lang === 'ko' ? '공지사항' : 'Notice'}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : !notice ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
            {lang === 'ko' ? '공지를 찾을 수 없어요.' : 'Notice not found.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {meta && (
              <View style={{ backgroundColor: meta.color, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {lang === 'ko' ? meta.ko : meta.en}
                </Text>
              </View>
            )}
            <Text style={{ color: colors.txTertiary, fontSize: 12 }}>
              {formatDate(notice.published_at)}
            </Text>
          </View>

          <Text style={{ color: colors.txPrimary, fontSize: 20, fontWeight: '800', lineHeight: 28, marginBottom: 16 }}>
            {notice.title}
          </Text>

          <Text style={{ color: colors.txSecondary, fontSize: 15, lineHeight: 24 }}>
            {notice.body}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
