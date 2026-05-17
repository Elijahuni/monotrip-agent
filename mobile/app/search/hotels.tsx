/**
 * Phase 2: 호텔 메타서치.
 * - 도시 빠른 선택 + 체크인/아웃
 * - 여성 친화·1인 친화·평점 필터
 * - 카드 탭 시 Booking/Agoda/야놀자 딥링크
 */
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { PriceTrendBadge } from '@/components/PriceTrendBadge';
import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import type { DataSource, HotelOffer, PriceTrend } from '@/lib/types';

const POPULAR_CITIES = [
  { key: 'tokyo', label: '도쿄' },
  { key: 'osaka', label: '오사카' },
  { key: 'kyoto', label: '교토' },
  { key: 'fukuoka', label: '후쿠오카' },
  { key: 'seoul', label: '서울' },
  { key: 'busan', label: '부산' },
  { key: 'jeju', label: '제주' },
];

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function HotelSearchScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ city?: string }>();

  const [city, setCity] = useState(params.city ?? 'tokyo');
  const [checkin, setCheckin] = useState(todayStr(30));
  const [checkout, setCheckout] = useState(todayStr(33));
  const [adults, setAdults] = useState(2);
  const [womenOnly, setWomenOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);

  const [offers, setOffers] = useState<HotelOffer[]>([]);
  const [trend, setTrend] = useState<PriceTrend | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nights = useMemo(() => {
    const a = new Date(checkin); const b = new Date(checkout);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
  }, [checkin, checkout]);

  const search = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await api.metasearch.hotels({
        city,
        checkin,
        checkout,
        adults,
        rooms: 1,
        min_rating: minRating ?? undefined,
        women_friendly_only: womenOnly || undefined,
      });
      setOffers(r.offers);
      setTrend(r.trend);
      setDataSource(r.data_source);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(err?.response?.data?.message ?? err?.message ?? '검색에 실패했어요');
      setOffers([]);
      setTrend(null);
      setDataSource(undefined);
    } finally {
      setLoading(false);
    }
  }, [city, checkin, checkout, adults, minRating, womenOnly]);

  // 화면 진입 시 자동 검색
  useEffect(() => { search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginLeft: 8 }}>
          🏨 숙소 검색
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {/* 폼 */}
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.lineDefault,
            gap: 12,
          }}>
          {/* 도시 빠른 선택 */}
          <View style={{ flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 6 }}>도시</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {POPULAR_CITIES.map((c) => {
                  const active = c.key === city;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setCity(c.key)}
                      style={{
                        flexShrink: 0,
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderRadius: 999, borderWidth: 1,
                        backgroundColor: active ? colors.txPrimary : colors.bgBase,
                        borderColor: active ? colors.txPrimary : colors.lineDefault,
                      }}>
                      <Text
                        allowFontScaling={false}
                        style={{ fontSize: 12, fontWeight: '700', color: active ? colors.bgBase : colors.txSecondary }}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 2 }}>체크인</Text>
              <TextInput
                value={checkin}
                onChangeText={setCheckin}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.txTertiary}
                style={{
                  fontSize: 14, color: colors.txPrimary,
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: 1, borderColor: colors.lineDefault, backgroundColor: colors.bgBase,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 2 }}>체크아웃</Text>
              <TextInput
                value={checkout}
                onChangeText={setCheckout}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.txTertiary}
                style={{
                  fontSize: 14, color: colors.txPrimary,
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: 1, borderColor: colors.lineDefault, backgroundColor: colors.bgBase,
                }}
              />
            </View>
          </View>

          {/* 인원 + 필터 토글 */}
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, color: colors.txSecondary }}>인원</Text>
            {[1, 2, 3, 4].map((n) => {
              const active = n === adults;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => setAdults(n)}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? colors.brandPrimary : colors.bgBase,
                    borderWidth: 1,
                    borderColor: active ? colors.brandPrimary : colors.lineDefault,
                  }}>
                  <Text
                    allowFontScaling={false}
                    style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.txSecondary }}>
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <FilterChip
              label="👩 여성 친화"
              active={womenOnly}
              onPress={() => setWomenOnly((v) => !v)}
              colors={colors}
              activeColor={colors.brandSecondary}
            />
            <FilterChip
              label="★ 4.0+"
              active={minRating === 4.0}
              onPress={() => setMinRating((v) => (v === 4.0 ? null : 4.0))}
              colors={colors}
            />
            <FilterChip
              label="★ 4.5+"
              active={minRating === 4.5}
              onPress={() => setMinRating((v) => (v === 4.5 ? null : 4.5))}
              colors={colors}
            />
          </View>

          <TouchableOpacity
            onPress={search}
            disabled={loading}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: loading ? colors.bgStrong : colors.brandPrimary,
            }}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                {nights}박 가격 비교
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {errorMsg ? <Text style={{ color: colors.txDanger, fontSize: 12 }}>{errorMsg}</Text> : null}

        {offers.length > 0 ? <DataSourceBadge source={dataSource} /> : null}
        <PriceTrendBadge trend={trend} />

        {offers.map((h) => (
          <HotelCard key={h.id} hotel={h} nights={nights} colors={colors} />
        ))}

        {!loading && offers.length === 0 && !errorMsg ? (
          <Text style={{ color: colors.txTertiary, textAlign: 'center', marginTop: 24 }}>
            조건에 맞는 숙소가 없어요
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label, active, onPress, colors, activeColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemedColors>;
  activeColor?: string;
}) {
  const bg = active ? (activeColor ?? colors.brandPrimary) : colors.bgBase;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        borderWidth: 1, backgroundColor: bg,
        borderColor: active ? bg : colors.lineDefault,
      }}>
      <Text
        allowFontScaling={false}
        style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.txSecondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HotelCard({
  hotel, nights, colors,
}: { hotel: HotelOffer; nights: number; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(hotel.deeplink)}
      style={({ pressed }) => ({
        padding: 16,
        borderRadius: 14,
        backgroundColor: pressed ? colors.bgSubtle : colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.lineDefault,
      })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.txPrimary }} numberOfLines={1}>
            {hotel.name}
          </Text>
          <Text style={{ fontSize: 11, color: colors.txTertiary, marginTop: 2 }} numberOfLines={1}>
            {hotel.address}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {hotel.rating ? (
              <Text style={{ fontSize: 11, color: colors.txSecondary, fontWeight: '700' }}>
                ⭐ {hotel.rating.toFixed(1)}
                {hotel.review_count ? ` (${hotel.review_count.toLocaleString()})` : ''}
              </Text>
            ) : null}
            {hotel.star_rating ? (
              <Text style={{ fontSize: 11, color: colors.txTertiary }}>
                {'★'.repeat(hotel.star_rating)}
              </Text>
            ) : null}
            {hotel.women_floor ? (
              <Text style={{ fontSize: 10, color: colors.brandSecondary, fontWeight: '700' }}>
                👩 여성층
              </Text>
            ) : null}
            {hotel.solo_friendly ? (
              <Text style={{ fontSize: 10, color: colors.txTertiary }}>· 1인 OK</Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brandPrimary }}>
            ₩{hotel.price_per_night_krw.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: colors.txTertiary, marginTop: 2 }}>1박</Text>
          <Text style={{ fontSize: 10, color: colors.txTertiary, marginTop: 2 }}>
            총 ₩{hotel.total_price_krw.toLocaleString()} ({nights}박)
          </Text>
          <Text style={{ fontSize: 10, color: colors.txTertiary, marginTop: 2 }}>
            {hotel.affiliate_source}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
