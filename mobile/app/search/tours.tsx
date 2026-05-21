/**
 * 투어·티켓 검색 — GET /tours/search (메타서치, mock|live)
 * 도시 + 카테고리로 상품을 찾고, 제휴 딥링크로 예약 페이지 이동.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import type { DataSource, TourCategory, TourOffer } from '@/lib/types';

const CATEGORIES: { key: TourCategory | 'all'; ko: string; en: string }[] = [
  { key: 'all', ko: '전체', en: 'All' },
  { key: 'activity', ko: '액티비티', en: 'Activity' },
  { key: 'attraction', ko: '입장권', en: 'Tickets' },
  { key: 'tour', ko: '투어', en: 'Tours' },
  { key: 'show', ko: '공연', en: 'Shows' },
  { key: 'food', ko: '미식', en: 'Food' },
  { key: 'transport', ko: '교통', en: 'Transport' },
];

export default function ToursSearchScreen() {
  const params = useLocalSearchParams<{ city?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [city, setCity] = useState(params.city ?? '');
  const [category, setCategory] = useState<TourCategory | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<TourOffer[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('mock');
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    if (!city.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await api.tours.search({
        city: city.trim(),
        category: category === 'all' ? undefined : category,
      });
      setOffers(r.offers);
      setDataSource(r.data_source);
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [city, category]);

  // city 파라미터로 들어오면 자동 검색
  useEffect(() => {
    if (params.city) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
            {lang === 'ko' ? '투어·티켓' : 'Tours & Tickets'}
          </Text>
        </View>
        {/* 검색 입력 */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={lang === 'ko' ? '도시 (예: 도쿄)' : 'City (e.g. Tokyo)'}
            placeholderTextColor={colors.txDisabled}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            style={{
              flex: 1,
              backgroundColor: colors.bgBase,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.txPrimary,
              fontSize: 15,
            }}
          />
          <TouchableOpacity
            onPress={runSearch}
            style={{ backgroundColor: palette.coral500, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={() =>
            offers.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <DataSourceBadge source={dataSource} />
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎟️</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14, textAlign: 'center' }}>
                {searched
                  ? (lang === 'ko' ? '검색 결과가 없어요.' : 'No results.')
                  : (lang === 'ko' ? '도시를 입력해 투어를 찾아보세요.' : 'Search a city to find tours.')}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Linking.openURL(item.deeplink)}
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.lineDefault,
              }}
            >
              <Text style={{ color: colors.txPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {item.rating != null && (
                  <Text style={{ color: colors.txSecondary, fontSize: 12 }}>⭐ {item.rating} ({item.review_count})</Text>
                )}
                {item.duration_hours != null && (
                  <Text style={{ color: colors.txTertiary, fontSize: 12 }}>⏱ {item.duration_hours}h</Text>
                )}
                {item.instant_confirmation && (
                  <Text style={{ color: '#27AE60', fontSize: 11, fontWeight: '600' }}>{lang === 'ko' ? '즉시확정' : 'Instant'}</Text>
                )}
                {item.free_cancellation && (
                  <Text style={{ color: '#5B8DEF', fontSize: 11, fontWeight: '600' }}>{lang === 'ko' ? '무료취소' : 'Free cancel'}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: palette.coral500, fontWeight: '800', fontSize: 17 }}>
                  ₩{item.price_krw.toLocaleString()}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.txTertiary, fontSize: 11 }}>{item.affiliate_source}</Text>
                  <Ionicons name="open-outline" size={14} color={colors.txTertiary} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
