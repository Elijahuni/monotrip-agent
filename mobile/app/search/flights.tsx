/**
 * Phase 2: 항공권 메타서치 검색 화면.
 * - IATA 자동완성: 기존 flight-links.ts의 200+ 도시 매핑 재사용
 * - 가격 오름차순 기본 + 항공사 필터 칩
 * - 결과 카드 탭 시 외부 OTA 딥링크 (Skyscanner/Naver/Kayak)
 */
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import type { DataSource, FlightOffer, PriceTrend } from '@/lib/types';

// 자주 가는 도시 — IATA 빠른 선택
const POPULAR_AIRPORTS = [
  { iata: 'ICN', label: '인천' },
  { iata: 'GMP', label: '김포' },
  { iata: 'PUS', label: '부산' },
  { iata: 'CJU', label: '제주' },
  { iata: 'NRT', label: '도쿄(나리타)' },
  { iata: 'HND', label: '도쿄(하네다)' },
  { iata: 'KIX', label: '오사카' },
  { iata: 'FUK', label: '후쿠오카' },
  { iata: 'CTS', label: '삿포로' },
  { iata: 'OKA', label: '오키나와' },
];

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function FlightSearchScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();

  const [from, setFrom] = useState('ICN');
  const [to, setTo] = useState('NRT');
  const [depart, setDepart] = useState(todayStr(30));
  const [returnDate, setReturnDate] = useState<string | null>(todayStr(35));

  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [trend, setTrend] = useState<PriceTrend | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [airlineFilter, setAirlineFilter] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setAirlineFilter(null);
    try {
      const r = await api.metasearch.flights({
        from_iata: from.toUpperCase(),
        to_iata: to.toUpperCase(),
        depart_date: depart,
        return_date: returnDate ?? undefined,
        adults: 1,
        cabin: 'economy',
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
  }, [from, to, depart, returnDate]);

  // 결과의 unique 항공사 (필터 칩)
  const airlines = useMemo(() => {
    const s = new Set(offers.map((o) => o.airline));
    return Array.from(s);
  }, [offers]);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (directOnly && o.stops > 0) return false;
      if (airlineFilter && o.airline !== airlineFilter) return false;
      return true;
    });
  }, [offers, airlineFilter, directOnly]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 헤더 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginLeft: 8 }}>
          ✈️ 항공권 검색
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {/* 검색 폼 */}
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.lineDefault,
            gap: 12,
          }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <IataField label="출발" value={from} onChange={setFrom} colors={colors} />
            <TouchableOpacity
              onPress={() => { setFrom(to); setTo(from); }}
              style={{
                alignSelf: 'center',
                width: 36, height: 36, borderRadius: 18,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.bgSubtle,
              }}>
              <Text style={{ color: colors.brandPrimary, fontSize: 16 }}>⇄</Text>
            </TouchableOpacity>
            <IataField label="도착" value={to} onChange={setTo} colors={colors} />
          </View>

          {/* IATA 빠른 선택 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {POPULAR_AIRPORTS.map((a) => (
                <TouchableOpacity
                  key={a.iata}
                  onPress={() => setTo(a.iata)}
                  style={{
                    flexShrink: 0,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.lineDefault,
                    backgroundColor: colors.bgBase,
                  }}>
                  <Text style={{ fontSize: 11, color: colors.txSecondary, fontWeight: '600' }}>
                    {a.iata} {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <DateField label="출발일" value={depart} onChange={setDepart} colors={colors} />
            <DateField
              label="복귀일 (옵션)"
              value={returnDate ?? ''}
              onChange={(v) => setReturnDate(v.trim() ? v : null)}
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
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>가격 비교하기</Text>
            )}
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <Text style={{ color: colors.txDanger, fontSize: 12 }}>{errorMsg}</Text>
        ) : null}

        {offers.length > 0 ? <DataSourceBadge source={dataSource} /> : null}
        <PriceTrendBadge trend={trend} />

        {/* 필터 */}
        {offers.length > 0 ? (
          <View style={{ flexShrink: 0 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <FilterChip
                  label="직항만"
                  active={directOnly}
                  onPress={() => setDirectOnly((v) => !v)}
                  colors={colors}
                />
                {airlines.map((a) => (
                  <FilterChip
                    key={a}
                    label={a}
                    active={airlineFilter === a}
                    onPress={() => setAirlineFilter((cur) => (cur === a ? null : a))}
                    colors={colors}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* 결과 */}
        {filtered.map((offer) => (
          <OfferCard key={offer.id} offer={offer} colors={colors} />
        ))}

        {!loading && offers.length === 0 && !errorMsg ? (
          <Text style={{ color: colors.txTertiary, textAlign: 'center', marginTop: 24 }}>
            출발지·도착지·날짜를 입력하고 검색해보세요
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── 하위 컴포넌트 ────────────────────────────────────────────────────────────

function IataField({
  label, value, onChange, colors,
}: { label: string; value: string; onChange: (v: string) => void; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 2 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3))}
        autoCapitalize="characters"
        maxLength={3}
        placeholder="IATA"
        placeholderTextColor={colors.txTertiary}
        style={{
          fontSize: 18, fontWeight: '800', color: colors.txPrimary,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
          borderWidth: 1, borderColor: colors.lineDefault, backgroundColor: colors.bgBase,
        }}
      />
    </View>
  );
}

function DateField({
  label, value, onChange, colors,
}: { label: string; value: string; onChange: (v: string) => void; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 2 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.txTertiary}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={{
          fontSize: 14, color: colors.txPrimary,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
          borderWidth: 1, borderColor: colors.lineDefault, backgroundColor: colors.bgBase,
        }}
      />
    </View>
  );
}

function FilterChip({
  label, active, onPress, colors,
}: { label: string; active: boolean; onPress: () => void; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexShrink: 0,
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 999, borderWidth: 1,
        backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
        borderColor: active ? colors.brandPrimary : colors.lineDefault,
      }}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.txSecondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function OfferCard({ offer, colors }: { offer: FlightOffer; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(offer.deeplink)}
      style={({ pressed }) => ({
        padding: 16,
        borderRadius: 14,
        backgroundColor: pressed ? colors.bgSubtle : colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.lineDefault,
      })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.txPrimary }}>{offer.airline}</Text>
          <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>
            {formatTime(offer.depart_time)} → {formatTime(offer.arrive_time)} · {formatDuration(offer.duration_minutes)}
            {offer.stops > 0 ? ` · 경유 ${offer.stops}` : ' · 직항'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.brandPrimary }}>
            ₩{offer.price_krw.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: colors.txTertiary, marginTop: 2 }}>
            {offer.affiliate_source}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
