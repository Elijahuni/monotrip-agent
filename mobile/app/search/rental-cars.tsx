/**
 * 렌터카·보험 검색 — GET /rental-cars/search (메타서치, mock|live)
 * 도시 + 대여/반납일 + 보험 수준으로 차량을 찾고 제휴 딥링크로 예약.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { IconButton, ListSkeleton } from '@/components/ui';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import type { DataSource, InsuranceLevel, RentalCarOffer } from '@/lib/types';

function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const INSURANCE: { key: InsuranceLevel | 'all'; ko: string; en: string }[] = [
  { key: 'all', ko: '전체', en: 'All' },
  { key: 'none', ko: '보험 없음', en: 'None' },
  { key: 'basic', ko: '기본', en: 'Basic' },
  { key: 'full', ko: '완전자차', en: 'Full' },
];

const CLASS_LABEL: Record<string, { ko: string; en: string }> = {
  economy: { ko: '경차', en: 'Economy' },
  compact: { ko: '준중형', en: 'Compact' },
  midsize: { ko: '중형', en: 'Midsize' },
  suv: { ko: 'SUV', en: 'SUV' },
  van: { ko: '승합', en: 'Van' },
  luxury: { ko: '고급', en: 'Luxury' },
};

function insuranceLabel(level: string, lang: string): string {
  if (level === 'full') return lang === 'ko' ? '완전자차' : 'Full cover';
  if (level === 'basic') return lang === 'ko' ? '기본보험' : 'Basic';
  return lang === 'ko' ? '보험 미포함' : 'No insurance';
}

export default function RentalCarsSearchScreen() {
  const params = useLocalSearchParams<{ city?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [city, setCity] = useState(params.city ?? '');
  const [pickup, setPickup] = useState(todayStr(7));
  const [ret, setRet] = useState(todayStr(10));
  const [insurance, setInsurance] = useState<InsuranceLevel | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<RentalCarOffer[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('mock');
  const [days, setDays] = useState(0);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    if (!city.trim()) return;
    setLoading(true);
    setSearched(true);
    setErrorMsg(null);
    try {
      const r = await api.rentalCars.search({
        city: city.trim(),
        pickup_date: pickup,
        return_date: ret,
        insurance_level: insurance === 'all' ? undefined : insurance,
      });
      track('rental_search', { city: city.trim(), insurance, results: r.offers.length });
      setOffers(r.offers);
      setDataSource(r.data_source);
      setDays(r.rental_days);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      setOffers([]);
      if (err?.response?.status === 422) {
        setErrorMsg(lang === 'ko' ? '반납일은 대여일보다 이후여야 해요.' : 'Return date must be after pickup.');
      } else {
        setErrorMsg(lang === 'ko' ? '검색에 실패했어요.' : 'Search failed.');
      }
    } finally {
      setLoading(false);
    }
  }, [city, pickup, ret, insurance, lang]);

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
          <IconButton
            icon="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel={lang === 'ko' ? '뒤로' : 'Back'}
            style={{ marginRight: 8 }}
          />
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
            {lang === 'ko' ? '렌터카·보험' : 'Rental Cars'}
          </Text>
        </View>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder={lang === 'ko' ? '대여 도시 (예: 제주)' : 'City (e.g. Jeju)'}
          placeholderTextColor={colors.txDisabled}
          style={{ backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.txPrimary, fontSize: 15, marginBottom: 8 }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={pickup}
            onChangeText={setPickup}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.txDisabled}
            style={{ flex: 1, backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.txPrimary, fontSize: 14 }}
          />
          <TextInput
            value={ret}
            onChangeText={setRet}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.txDisabled}
            style={{ flex: 1, backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.txPrimary, fontSize: 14 }}
          />
          <TouchableOpacity onPress={runSearch} style={{ backgroundColor: palette.coral500, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 보험 수준 칩 */}
      <View style={{ paddingVertical: 10 }}>
        <FlatList
          data={INSURANCE}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          keyExtractor={(c) => c.key}
          renderItem={({ item }) => {
            const active = insurance === item.key;
            return (
              <TouchableOpacity
                onPress={() => setInsurance(item.key)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: active ? palette.coral500 : colors.bgSurface, borderWidth: 1, borderColor: active ? palette.coral500 : colors.lineDefault }}
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
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={() =>
            offers.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <DataSourceBadge source={dataSource} />
                <Text style={{ color: colors.txTertiary, fontSize: 12 }}>
                  {lang === 'ko' ? `${days}일 대여` : `${days} days`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🚗</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14, textAlign: 'center' }}>
                {errorMsg
                  ? errorMsg
                  : searched
                    ? (lang === 'ko' ? '검색 결과가 없어요.' : 'No results.')
                    : (lang === 'ko' ? '도시와 날짜로 렌터카를 찾아보세요.' : 'Search rental cars.')}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Linking.openURL(item.deeplink)}
              style={{ backgroundColor: colors.bgSurface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.lineDefault }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.txPrimary, fontSize: 15, fontWeight: '700' }}>
                  {CLASS_LABEL[item.car_class]?.[lang === 'ko' ? 'ko' : 'en'] ?? item.car_class}
                </Text>
                <Text style={{ color: colors.txTertiary, fontSize: 12 }}>{item.vendor}</Text>
              </View>
              <Text style={{ color: colors.txSecondary, fontSize: 13, marginTop: 2 }}>
                {item.car_model} · {item.seats}{lang === 'ko' ? '인승' : ' seats'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: item.insurance_level === 'full' ? '#27AE60' : item.insurance_level === 'basic' ? '#5B8DEF' : colors.bgStrong, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9 }}>
                  <Text style={{ color: item.insurance_level === 'none' ? colors.txTertiary : '#fff', fontSize: 10, fontWeight: '700' }}>
                    {insuranceLabel(item.insurance_level, lang)}
                  </Text>
                </View>
                {item.free_cancellation && (
                  <Text style={{ color: '#5B8DEF', fontSize: 11, fontWeight: '600' }}>{lang === 'ko' ? '무료취소' : 'Free cancel'}</Text>
                )}
                {item.unlimited_mileage && (
                  <Text style={{ color: colors.txTertiary, fontSize: 11 }}>{lang === 'ko' ? '주행거리 무제한' : 'Unlimited km'}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
                <View>
                  <Text style={{ color: palette.coral500, fontWeight: '800', fontSize: 17 }}>
                    ₩{item.total_price_krw.toLocaleString()}
                  </Text>
                  <Text style={{ color: colors.txTertiary, fontSize: 11 }}>
                    {lang === 'ko' ? `1일 ₩${item.price_per_day_krw.toLocaleString()}` : `₩${item.price_per_day_krw.toLocaleString()}/day`}
                  </Text>
                </View>
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
