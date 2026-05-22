/**
 * 쿠폰함 — 보유 쿠폰 / 발급 가능 혜택 두 탭.
 * - 발급 가능: GET /coupons/available → 발급(POST /coupons/{id}/claim)
 * - 보유: GET /coupons/me → 사용(POST /coupons/me/{id}/use)
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { ListSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { notifySuccess, tapMedium } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import type { AvailableCoupon, MyCoupon, MyCouponStatus } from '@/lib/types';

type Tab = 'mine' | 'available';

function discountLabel(type: string, value: number): string {
  return type === 'percent' ? `${value}%` : `₩${value.toLocaleString()}`;
}

function statusMeta(status: MyCouponStatus, lang: string): { label: string; color: string } {
  if (status === 'used') return { label: lang === 'ko' ? '사용완료' : 'Used', color: '#9AA5B1' };
  if (status === 'expired') return { label: lang === 'ko' ? '만료' : 'Expired', color: '#E74C3C' };
  return { label: lang === 'ko' ? '사용가능' : 'Available', color: '#27AE60' };
}

export default function CouponsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [tab, setTab] = useState<Tab>('mine');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [mine, setMine] = useState<MyCoupon[]>([]);
  const [available, setAvailable] = useState<AvailableCoupon[]>([]);

  const fetchData = useCallback(async () => {
    const [m, a] = await Promise.all([api.coupons.mine(), api.coupons.available()]);
    setMine(m);
    setAvailable(a);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchData();
    } catch {
      setMine([]);
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tapMedium();
    try {
      await fetchData();
    } catch {
      /* 유지 */
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClaim(c: AvailableCoupon) {
    setBusyId(c.id);
    try {
      await api.coupons.claim(c.id);
      notifySuccess();
      Toast.show({ type: 'success', text1: lang === 'ko' ? '쿠폰을 받았어요 🎉' : 'Coupon claimed 🎉', visibilityTime: 1600 });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? (lang === 'ko' ? '발급 실패' : 'Claim failed'), visibilityTime: 2000 });
    } finally {
      setBusyId(null);
    }
  }

  async function handleUse(c: MyCoupon) {
    setBusyId(c.user_coupon_id);
    try {
      await api.coupons.use(c.user_coupon_id);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? (lang === 'ko' ? '사용 실패' : 'Failed'), visibilityTime: 2000 });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
            {lang === 'ko' ? '쿠폰함' : 'Coupons'}
          </Text>
        </View>
        {/* 탭 */}
        <View style={{ flexDirection: 'row' }}>
          {(['mine', 'available'] as Tab[]).map((tk) => {
            const active = tab === tk;
            const label = tk === 'mine'
              ? (lang === 'ko' ? `보유 (${mine.length})` : `My (${mine.length})`)
              : (lang === 'ko' ? '발급 가능' : 'Available');
            return (
              <TouchableOpacity
                key={tk}
                onPress={() => setTab(tk)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: active ? palette.coral500 : 'transparent' }}
              >
                <Text style={{ color: active ? palette.coral500 : colors.txTertiary, fontWeight: '700', fontSize: 14 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ListSkeleton count={5} />
      ) : tab === 'available' ? (
        <FlatList
          data={available}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.coral500} colors={[palette.coral500]} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎟️</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '발급 가능한 쿠폰이 없어요.' : 'No coupons available.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.lineDefault }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.coral500, fontWeight: '800', fontSize: 18 }}>
                  {discountLabel(item.discount_type, item.discount_value)}
                </Text>
                <Text style={{ color: colors.txPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{item.title}</Text>
                {item.min_order_amount > 0 && (
                  <Text style={{ color: colors.txTertiary, fontSize: 11, marginTop: 2 }}>
                    {lang === 'ko' ? `₩${item.min_order_amount.toLocaleString()} 이상` : `Min ₩${item.min_order_amount.toLocaleString()}`}
                  </Text>
                )}
              </View>
              {item.already_claimed ? (
                <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.bgStrong }}>
                  <Text style={{ color: colors.txTertiary, fontSize: 13, fontWeight: '700' }}>
                    {lang === 'ko' ? '발급완료' : 'Claimed'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => handleClaim(item)}
                  disabled={busyId === item.id}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: palette.coral500 }}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{lang === 'ko' ? '받기' : 'Claim'}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={mine}
          keyExtractor={(c) => String(c.user_coupon_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.coral500} colors={[palette.coral500]} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎫</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14, textAlign: 'center' }}>
                {lang === 'ko' ? '보유한 쿠폰이 없어요.\n발급 가능 탭에서 받아보세요.' : 'No coupons yet.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const meta = statusMeta(item.status, lang);
            const usable = item.status === 'available';
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.lineDefault, opacity: usable ? 1 : 0.6 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: palette.coral500, fontWeight: '800', fontSize: 18 }}>
                      {discountLabel(item.discount_type, item.discount_value)}
                    </Text>
                    <View style={{ backgroundColor: meta.color, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.txPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{item.title}</Text>
                </View>
                {usable && (
                  <TouchableOpacity
                    onPress={() => handleUse(item)}
                    disabled={busyId === item.user_coupon_id}
                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: palette.coral500 }}
                  >
                    {busyId === item.user_coupon_id ? (
                      <ActivityIndicator size="small" color={palette.coral500} />
                    ) : (
                      <Text style={{ color: palette.coral500, fontSize: 13, fontWeight: '700' }}>{lang === 'ko' ? '사용' : 'Use'}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
