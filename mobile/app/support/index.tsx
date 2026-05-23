/**
 * 고객센터 — FAQ 아코디언 (GET /faqs)
 * 카테고리 필터 칩 + 질문 탭 시 답변 펼침.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Accordion, IconButton, ListSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { tapMedium } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import type { FaqCategory, FaqItem } from '@/lib/types';

const CATEGORIES: { key: FaqCategory | 'all'; ko: string; en: string }[] = [
  { key: 'all', ko: '전체', en: 'All' },
  { key: 'general', ko: '일반', en: 'General' },
  { key: 'account', ko: '계정', en: 'Account' },
  { key: 'booking', ko: '예약', en: 'Booking' },
  { key: 'payment', ko: '결제', en: 'Payment' },
  { key: 'travel', ko: '여행', en: 'Travel' },
  { key: 'etc', ko: '기타', en: 'Etc' },
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFaqs(await api.faqs.list(category === 'all' ? {} : { category }));
    } catch {
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tapMedium();
    try {
      setFaqs(await api.faqs.list(category === 'all' ? {} : { category }));
    } catch {
      /* 유지 */
    } finally {
      setRefreshing(false);
    }
  }, [category]);

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
        <IconButton
          icon="chevron-back"
          onPress={() => router.back()}
          accessibilityLabel={lang === 'ko' ? '뒤로' : 'Back'}
          style={{ marginRight: 8 }}
        />
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
          {lang === 'ko' ? '고객센터' : 'Help Center'}
        </Text>
      </View>

      {/* 카테고리 칩 */}
      <View style={{ paddingVertical: 10 }}>
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyExtractor={(c) => c.key}
          renderItem={({ item }) => {
            const active = category === item.key;
            return (
              <TouchableOpacity
                onPress={() => setCategory(item.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 18,
                  backgroundColor: active ? palette.coral500 : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: active ? palette.coral500 : colors.lineDefault,
                }}
              >
                <Text style={{ color: active ? '#fff' : colors.txSecondary, fontSize: 13, fontWeight: '600' }}>
                  {lang === 'ko' ? item.ko : item.en}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <ListSkeleton count={6} />
      ) : (
        <FlatList
          data={faqs}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.coral500} colors={[palette.coral500]} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '등록된 FAQ가 없어요.' : 'No FAQs yet.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Accordion title={item.question} badge="Q">
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ color: colors.txTertiary, fontWeight: '800', fontSize: 15, marginRight: 8 }}>A</Text>
                <Text style={{ flex: 1, color: colors.txSecondary, fontSize: 14, lineHeight: 22 }}>
                  {item.answer}
                </Text>
              </View>
            </Accordion>
          )}
        />
      )}
    </View>
  );
}
