/**
 * 오프라인 가이드 상세 — 로컬 우선 열람 + 다운로드/삭제.
 * 1) 캐시가 있으면 즉시 표시(오프라인 OK)
 * 2) 온라인이면 최신본 fetch → 캐시 갱신
 * 3) 다운로드 버튼으로 명시적 저장, 삭제 버튼으로 캐시 제거
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { deleteCachedGuide, getCachedGuide, saveCachedGuide } from '@/lib/local-offline-guides';
import { useSettings } from '@/lib/settings-context';
import type { OfflineGuideDetail } from '@/lib/types';

export default function OfflineGuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guideId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<OfflineGuideDetail | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const load = useCallback(async () => {
    // 1) 로컬 우선
    const cached = await getCachedGuide(guideId);
    if (cached) {
      setGuide(cached);
      setDownloaded(true);
    }
    // 2) 온라인 최신본 시도
    try {
      const fresh = await api.offlineGuides.get(guideId);
      setGuide(fresh);
      // 이미 다운로드한 가이드면 캐시 최신화
      if (cached) {
        await saveCachedGuide(fresh);
        setDownloaded(true);
      }
    } catch {
      // 오프라인: 캐시본 유지
    } finally {
      setLoading(false);
    }
  }, [guideId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload() {
    if (!guide) return;
    setBusy(true);
    try {
      // 항상 최신본을 받아 저장
      const fresh = await api.offlineGuides.get(guideId).catch(() => guide);
      await saveCachedGuide(fresh);
      setGuide(fresh);
      setDownloaded(true);
      Toast.show({ type: 'success', text1: lang === 'ko' ? '오프라인 저장 완료 ✓' : 'Saved offline ✓', visibilityTime: 1500 });
    } catch {
      Toast.show({ type: 'error', text1: lang === 'ko' ? '다운로드 실패' : 'Download failed', visibilityTime: 2000 });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteCachedGuide(guideId);
      setDownloaded(false);
      Toast.show({ type: 'info', text1: lang === 'ko' ? '다운로드 삭제됨' : 'Removed', visibilityTime: 1500 });
    } finally {
      setBusy(false);
    }
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
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.txPrimary }} numberOfLines={1}>
          {guide?.title ?? (lang === 'ko' ? '가이드' : 'Guide')}
        </Text>
        {guide && (
          busy ? (
            <ActivityIndicator size="small" color={palette.coral500} />
          ) : downloaded ? (
            <TouchableOpacity onPress={handleDelete} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="trash-outline" size={18} color="#E74C3C" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleDownload} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.coral500, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 }}>
              <Ionicons name="download-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {lang === 'ko' ? '다운로드' : 'Download'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {loading && !guide ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : !guide ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
            {lang === 'ko' ? '가이드를 찾을 수 없어요.' : 'Guide not found.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ color: colors.txTertiary, fontSize: 12, marginBottom: 4 }}>
            {guide.city}{guide.country ? ` · ${guide.country}` : ''}
            {downloaded ? (lang === 'ko' ? '  ·  오프라인 저장됨' : '  ·  Saved offline') : ''}
          </Text>
          <Text style={{ color: colors.txPrimary, fontSize: 22, fontWeight: '800', lineHeight: 30, marginBottom: 8 }}>
            {guide.title}
          </Text>
          {!!guide.summary && (
            <Text style={{ color: colors.txSecondary, fontSize: 15, lineHeight: 23, marginBottom: 20 }}>
              {guide.summary}
            </Text>
          )}

          {guide.sections.map((s, i) => (
            <View key={i} style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.txPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
                {s.heading}
              </Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14, lineHeight: 23 }}>
                {s.body}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
