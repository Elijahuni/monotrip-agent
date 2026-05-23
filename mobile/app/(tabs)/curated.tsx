/**
 * Phase 1-1: 큐레이션 탭 — 포토스팟·감성 카페·디저트 핀터레스트 그리드.
 *
 * 데이터 흐름: 현재는 백엔드 직접 호출 (큐레이션 데이터는 휘발성 낮고 도시별 캐시 가능).
 * 추후 SQLite 캐시 + offline read를 lib/local-curated.ts로 분리할 수 있다.
 */
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { CuratedPlaceModal } from '@/components/CuratedPlaceModal';
import { VibeChips, localizeVibeTag } from '@/components/VibeChips';
import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import { readCuratedCache, writeCuratedCache } from '@/lib/local-curated';
import { useSettings } from '@/lib/settings-context';
import { useIsOnline } from '@/store';
import type { CuratedPlace } from '@/lib/types';
import Toast from 'react-native-toast-message';

const JAPAN_CITIES = new Set(['tokyo', 'osaka', 'kyoto', 'fukuoka']);
const KOREA_CITIES = new Set(['seoul', 'busan', 'jeju', 'gangneung']);

// ─── 도시·카테고리 슬러그 목록 (라벨은 i18n으로 런타임에 결정됨) ─────────────
const CITY_KEYS = ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'seoul', 'jeju', 'busan', 'gangneung'] as const;
type CityKey = (typeof CITY_KEYS)[number];

const CATEGORY_OPTIONS: { key: string; emoji: string }[] = [
  { key: '',           emoji: '✨' },
  { key: 'cafe',       emoji: '☕' },
  { key: 'dessert',    emoji: '🍰' },
  { key: 'photospot',  emoji: '📸' },
  { key: 'shopping',   emoji: '🛍️' },
  { key: 'restaurant', emoji: '🍜' },
];

// 카테고리별 카드 비율 (Pinterest 풍 staggered 효과). 1.0=정사각, 1.4=세로형
const ASPECT_BY_CATEGORY: Record<string, number> = {
  cafe: 1.25,
  dessert: 1.0,
  photospot: 1.45,
  shopping: 1.15,
  restaurant: 1.1,
};

export default function CuratedTab() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const { width } = useWindowDimensions();
  const { t, lang } = useSettings();

  const [city, setCity] = useState<string>('tokyo');
  const [category, setCategory] = useState<string>('');
  const [vibes, setVibes] = useState<string[]>([]);
  const [womenOnly, setWomenOnly] = useState(false);

  const [items, setItems] = useState<CuratedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<CuratedPlace | null>(null);

  const cardWidth = (width - 16 * 2 - 12) / 2; // 16 padding + 12 gutter
  const isOnline = useIsOnline();
  const router = useRouter();

  const load = useCallback(async () => {
    setErrorMsg(null);
    const filterKey = {
      city,
      category: category || undefined,
      vibes: vibes.length ? vibes : undefined,
      womenFriendly: womenOnly,
    };

    // 1) 캐시 먼저 — 즉시 표시
    const cached = await readCuratedCache(filterKey);
    if (cached && cached.length > 0) {
      setItems(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2) 오프라인이고 캐시도 없으면 종료
    if (!isOnline) {
      setLoading(false);
      setRefreshing(false);
      if (!cached) setErrorMsg(t('curated', 'offlineNoCache'));
      return;
    }

    // 3) 백엔드 fetch + 캐시 갱신
    try {
      const data = await api.places.curated({
        city,
        category: category || undefined,
        vibes: vibes.length ? vibes : undefined,
        women_friendly: womenOnly || undefined,
        limit: 40,
      });
      setItems(data);
      // 결과가 있을 때만 캐시 갱신 (빈 결과 캐시는 다음 로드 시 헷갈림)
      if (data.length > 0) {
        writeCuratedCache(filterKey, data).catch(() => undefined);
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = err?.response?.status;
      const detail = err?.response?.data?.message ?? err?.message ?? '알 수 없는 오류';
      console.warn('[curated] load failed', status, detail, err);
      // 캐시가 있으면 그대로 두고 에러는 무시 (이미 캐시로 화면 채움)
      if (!cached) {
        setErrorMsg(status ? `(${status}) ${detail}` : detail);
        setItems([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, category, vibes, womenOnly, isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // 두 컬럼으로 나눠 staggered 그리드 (FlatList numColumns는 동일 행 정렬이라 부적합)
  const [left, right] = useMemo(() => {
    const l: CuratedPlace[] = [];
    const r: CuratedPlace[] = [];
    let lHeight = 0;
    let rHeight = 0;
    for (const item of items) {
      const aspect = ASPECT_BY_CATEGORY[item.category] ?? 1.2;
      const h = cardWidth * aspect + 80; // 이미지 + 텍스트 영역
      if (lHeight <= rHeight) {
        l.push(item);
        lHeight += h;
      } else {
        r.push(item);
        rHeight += h;
      }
    }
    return [l, r];
  }, [items, cardWidth]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      {/* 필터 영역 — flexShrink:0으로 묶어, 아래 FlatList 콘텐츠가 커져도 압축되지 않도록 보호 */}
      <View style={{ flexShrink: 0 }}>
      {/* 헤더 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.txPrimary }}>
          {t('curated', 'title')}
        </Text>
        <Text style={{ fontSize: 13, color: colors.txTertiary, marginTop: 2 }}>
          {t('curated', 'subtitle')}
        </Text>
      </View>

      {/* 도시 선택 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {CITY_KEYS.map((key) => {
          const active = key === city;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setCity(key)}
              style={{
                flexShrink: 0,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? colors.txPrimary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.txPrimary : colors.lineDefault,
              }}>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? colors.bgBase : colors.txSecondary,
                }}>
                {t('cities', key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 카테고리 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
        {CATEGORY_OPTIONS.map((c) => {
          const active = c.key === category;
          const catKey = (c.key || 'all') as 'all' | 'cafe' | 'dessert' | 'photospot' | 'shopping' | 'restaurant';
          return (
            <TouchableOpacity
              key={c.key || 'all'}
              onPress={() => setCategory(c.key)}
              style={{
                flexShrink: 0,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.brandPrimary : colors.lineDefault,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
              <Text allowFontScaling={false} style={{ fontSize: 14 }}>{c.emoji}</Text>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: active ? '#FFFFFF' : colors.txSecondary,
                }}>
                {t('categoryFilter', catKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 일본·한국 도시일 때: 여행 도구 배너 */}
      {JAPAN_CITIES.has(city) ? (
        <ToolkitBanner
          flag="🇯🇵"
          title={t('curated', 'japanTitle')}
          subtitle={t('curated', 'japanSub')}
          color={colors.brandSecondary}
          onPress={() => router.push({ pathname: '/japan-toolkit', params: { city } })}
        />
      ) : KOREA_CITIES.has(city) ? (
        <ToolkitBanner
          flag="🇰🇷"
          title={t('curated', 'koreaTitle')}
          subtitle={t('curated', 'koreaSub')}
          color={colors.brandPrimary}
          onPress={() => router.push({ pathname: '/korea-toolkit', params: { city } })}
        />
      ) : null}

      {/* 항공/숙소 가격비교 행 */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8 }}>
        <SearchPill
          emoji="✈️"
          label={t('curated', 'flightSearch')}
          colors={colors}
          onPress={() => router.push('/search/flights')}
        />
        <SearchPill
          emoji="🏨"
          label={t('curated', 'hotelSearch')}
          colors={colors}
          onPress={() => router.push({ pathname: '/search/hotels', params: { city } })}
        />
      </View>

      {/* Vibe 칩 + 여성친화 토글 */}
      <VibeChips selected={vibes} onChange={setVibes} max={4} />
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => setWomenOnly((v) => !v)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: womenOnly ? colors.brandSecondary : colors.lineDefault,
            backgroundColor: womenOnly ? colors.brandSecondary : 'transparent',
          }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: womenOnly ? '#FFFFFF' : colors.txSecondary,
            }}>
            {t('curated', 'womenOnly')}
          </Text>
        </TouchableOpacity>
      </View>
      </View>{/* /필터 영역 */}

      {/* 결과 */}
      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.txSecondary }}>
            {errorMsg ? t('curated', 'loadFail') : t('curated', 'empty')}
          </Text>
          <Text style={{ fontSize: 13, color: colors.txTertiary, marginTop: 8, textAlign: 'center' }}>
            {errorMsg ?? t('curated', 'emptySub')}
          </Text>
          {errorMsg ? (
            <TouchableOpacity
              onPress={load}
              style={{
                marginTop: 16,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: colors.brandPrimary,
              }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('curated', 'retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={[null]}
          keyExtractor={() => 'staggered'}
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 }}
          renderItem={() => (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, gap: 12 }}>
                {left.map((p) => (
                  <CuratedCard key={p.id} place={p} width={cardWidth} colors={colors} lang={lang} onPress={setSelectedPlace} />
                ))}
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                {right.map((p) => (
                  <CuratedCard key={p.id} place={p} width={cardWidth} colors={colors} lang={lang} onPress={setSelectedPlace} />
                ))}
              </View>
            </View>
          )}
        />
      )}

      <CuratedPlaceModal
        visible={selectedPlace !== null}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onAdded={() => {
          Toast.show({
            type: 'success',
            text1: t('curated', 'addedToast'),
            visibilityTime: 2000,
            position: 'bottom',
          });
        }}
      />
    </View>
  );
}

// ─── 카드 ─────────────────────────────────────────────────────────────────────

// ─── Toolkit 진입 배너 ────────────────────────────────────────────────────────

function ToolkitBanner({
  flag,
  title,
  subtitle,
  color,
  onPress,
}: {
  flag: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        padding: 12,
        borderRadius: 14,
        backgroundColor: color,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <Text style={{ fontSize: 24 }}>{flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#FFFFFF', opacity: 0.9 }}>{subtitle}</Text>
      </View>
      <Text style={{ fontSize: 20, color: '#FFFFFF' }}>›</Text>
    </TouchableOpacity>
  );
}

function SearchPill({
  emoji, label, colors, onPress,
}: {
  emoji: string;
  label: string;
  colors: ReturnType<typeof useThemedColors>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.lineDefault,
      }}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.txPrimary }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: colors.txTertiary }}>›</Text>
    </TouchableOpacity>
  );
}

function CuratedCard({
  place,
  width,
  colors,
  lang,
  onPress,
}: {
  place: CuratedPlace;
  width: number;
  colors: ReturnType<typeof useThemedColors>;
  lang: 'ko' | 'en';
  onPress: (place: CuratedPlace) => void;
}) {
  const aspect = ASPECT_BY_CATEGORY[place.category] ?? 1.2;
  const imgHeight = width * aspect;

  // 영어 모드에서는 name_en 우선, 없으면 name 폴백
  const displayName = lang === 'en' && place.name_en ? place.name_en : place.name;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(place)}
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.lineDefault,
      }}>
      {place.cover_image ? (
        <Image
          source={{ uri: place.cover_image }}
          style={{ width, height: imgHeight, backgroundColor: colors.bgSubtle }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={{
            width,
            height: imgHeight,
            backgroundColor: colors.bgSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 32 }}>📍</Text>
        </View>
      )}

      <View style={{ padding: 10 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary }}>
          {displayName}
        </Text>
        {place.region ? (
          <Text style={{ fontSize: 11, color: colors.txTertiary, marginTop: 2 }}>
            {place.region}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {place.vibe_tags.slice(0, 2).map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.bgSubtle,
              }}>
              <Text style={{ fontSize: 10, color: colors.txSecondary, fontWeight: '600' }}>
                #{localizeVibeTag(tag, lang)}
              </Text>
            </View>
          ))}
          {place.women_friendly ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.brandSecondary,
              }}>
              <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}>👩</Text>
            </View>
          ) : null}
        </View>
        {place.rating ? (
          <Text style={{ fontSize: 11, color: colors.txTertiary, marginTop: 4 }}>
            ⭐ {place.rating.toFixed(1)}
            {place.review_count ? ` · ${place.review_count.toLocaleString()}` : ''}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
