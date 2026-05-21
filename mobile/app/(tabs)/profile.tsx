import * as Sentry from '@sentry/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { countConflicts } from '@/lib/conflicts';
import { useThemedColors } from '@/lib/design-tokens';
import { captureError } from '@/lib/sentry';
import { useSettings } from '@/lib/settings-context';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';
import type { Gamification, UserStats } from '@/lib/types';
import Toast from 'react-native-toast-message';
import { LevelBadge } from '@/components/LevelBadge';
import { BadgeGrid } from '@/components/BadgeGrid';

const SENTRY_DEBUG_VISIBLE =
  __DEV__ || process.env.EXPO_PUBLIC_SENTRY_FORCE_ENABLE === '1';

// ─── 통계 셀 ──────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  loading,
  onPress,
  colors,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  onPress?: () => void;
  colors: ReturnType<typeof useThemedColors>;
}) {
  return (
    <TouchableOpacity
      style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {loading || value === undefined ? (
        <View
          style={{
            width: 32,
            height: 20,
            borderRadius: 6,
            backgroundColor: colors.lineDefault,
            marginBottom: 6,
          }}
        />
      ) : (
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.txPrimary, marginBottom: 4 }}>
          {value}
        </Text>
      )}
      <Text style={{ fontSize: 11, color: colors.txTertiary, fontWeight: '500' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── 메뉴 행 ──────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  badge,
  value,
  onPress,
  colors,
}: {
  icon: string;
  label: string;
  badge?: boolean;
  value?: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemedColors>;
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: colors.lineDefault,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 18, marginRight: 12 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.txPrimary }}>{label}</Text>
      {badge && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#E74C3C',
            marginRight: 6,
          }}
        />
      )}
      {value !== undefined && (
        <Text style={{ fontSize: 13, color: colors.txSecondary, marginRight: 6 }}>{value}</Text>
      )}
      <Text style={{ fontSize: 18, color: colors.chevron, fontWeight: '300' }}>›</Text>
    </TouchableOpacity>
  );
}

// ─── 프로필 화면 ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, isDark, toggleDark, lang, toggleLang } = useSettings();
  const colors = useThemedColors();
  const [conflictCount, setConflictCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      countConflicts().then((n) => { if (!cancelled) setConflictCount(n); }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  const statsQuery = useQuery<UserStats>({
    queryKey: ['userStats'],
    queryFn: () => api.users.stats(),
    staleTime: 2 * 60 * 1000,
  });

  const gamificationQuery = useQuery<Gamification>({
    queryKey: ['gamification'],
    queryFn: () => api.users.gamification(),
    staleTime: 2 * 60 * 1000,
  });

  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;
  const gami = gamificationQuery.data;

  async function handleLogout() {
    Alert.alert(t('auth', 'logoutTitle'), t('auth', 'logoutConfirm'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('auth', 'logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  function comingSoon() {
    Toast.show({ type: 'info', text1: t('profile', 'comingSoon'), visibilityTime: 1800 });
  }

  const initial = user?.nickname?.charAt(0)?.toUpperCase() ?? 'T';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSurface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 상단 safe area spacer ── */}
        <View style={{ height: insets.top }} />

        {/* ── 프로필 헤더 ── */}
        <View
          style={{
            backgroundColor: colors.bgBase,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            alignItems: 'center',
          }}
        >
          {/* 아바타 */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#FF5A5F',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              shadowColor: '#FF5A5F',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{initial}</Text>
          </View>

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginBottom: 4 }}>
            {user?.nickname ?? '···'}
          </Text>

          <TouchableOpacity onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7}>
            <Text style={{ fontSize: 13, color: colors.brandPrimary, fontWeight: '600' }}>
              {t('profile', 'editProfile')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 통계 행 (4열) ── */}
        <View
          style={{
            backgroundColor: colors.bgBase,
            marginTop: 8,
            flexDirection: 'row',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.lineDefault,
          }}
        >
          <StatCell
            label={t('profile', 'myTrips')}
            value={stats?.trip_count}
            loading={statsLoading}
            onPress={() => router.push('/' as any)}
            colors={colors}
          />
          <View style={{ width: 1, backgroundColor: colors.lineDefault, marginVertical: 10 }} />
          <StatCell
            label={t('profile', 'mySaved')}
            value={stats?.saved_count}
            loading={statsLoading}
            onPress={() => router.push('/saved' as any)}
            colors={colors}
          />
          <View style={{ width: 1, backgroundColor: colors.lineDefault, marginVertical: 10 }} />
          <StatCell
            label={t('profile', 'myReviews')}
            value={stats?.review_count}
            loading={statsLoading}
            onPress={comingSoon}
            colors={colors}
          />
          <View style={{ width: 1, backgroundColor: colors.lineDefault, marginVertical: 10 }} />
          <StatCell
            label={t('profile', 'myLogs')}
            value={stats?.post_count}
            loading={statsLoading}
            onPress={comingSoon}
            colors={colors}
          />
        </View>

        {/* ── 레벨 & XP 카드 ── */}
        {gami && (
          <View style={{ marginTop: 8 }}>
            <LevelBadge
              xp={gami.xp}
              level={gami.level}
              levelTitleKo={gami.level_title_ko}
              levelTitleEn={gami.level_title_en}
              levelEmoji={gami.level_emoji}
              xpCurrent={gami.xp_current}
              xpRequired={gami.xp_required}
              xpPercentage={gami.xp_percentage}
              lang={lang}
            />
          </View>
        )}

        {/* ── 배지 컬렉션 ── */}
        {gami && (
          <BadgeGrid
            badges={gami.badges}
            lockedBadges={gami.locked_badges}
            lang={lang}
          />
        )}

        {/* ── 메뉴 리스트 ── */}
        <View style={{ backgroundColor: colors.bgBase, marginTop: 8 }}>
          <MenuRow icon="📅" label={t('profile', 'myBookings')} onPress={comingSoon} colors={colors} />
          <MenuRow icon="🎁" label={t('profile', 'coupons')} badge onPress={comingSoon} colors={colors} />
          <MenuRow icon="📍" label={t('profile', 'offlineGuide')} onPress={comingSoon} colors={colors} />
        </View>

        {/* ── 설정 그룹 ── */}
        <View style={{ backgroundColor: colors.bgBase, marginTop: 8 }}>
          {/* 언어 */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 15,
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>🌐</Text>
            <Text style={{ flex: 1, fontSize: 14, color: colors.txPrimary }}>{t('profile', 'language')}</Text>
            <TouchableOpacity
              onPress={toggleLang}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1.5,
                borderColor: colors.brandPrimary,
              }}
            >
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: lang === 'ko' ? colors.brandPrimary : 'transparent' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: lang === 'ko' ? '#fff' : colors.txSecondary }}>한국어</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: lang === 'en' ? colors.brandPrimary : 'transparent' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: lang === 'en' ? '#fff' : colors.txSecondary }}>EN</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 다크 모드 */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderTopColor: colors.lineDefault,
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 12 }}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={{ flex: 1, fontSize: 14, color: colors.txPrimary }}>{t('profile', 'darkMode')}</Text>
            <Switch value={isDark} onValueChange={toggleDark} trackColor={{ false: '#E8ECF2', true: '#FF5A5F' }} thumbColor="#FFFFFF" />
          </View>
        </View>

        {/* ── 법률 그룹 ── */}
        <View style={{ backgroundColor: colors.bgBase, marginTop: 8 }}>
          <MenuRow icon="📢" label={t('profile', 'notices')} onPress={() => router.push('/notices' as any)} colors={colors} />
          <MenuRow icon="🔒" label={t('profile', 'privacy')} onPress={() => router.push('/legal/privacy' as any)} colors={colors} />
          <MenuRow icon="📋" label={t('profile', 'terms')} onPress={() => router.push('/legal/terms' as any)} colors={colors} />
        </View>

        {/* ── 동기화 충돌 ── */}
        {conflictCount > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/conflicts')}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: colors.warnBg,
                borderWidth: 1,
                borderColor: colors.warnBorder,
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.warnText }}>
                  동기화 충돌 {conflictCount}건
                </Text>
                <Text style={{ fontSize: 11, color: colors.warnSub, marginTop: 2 }}>
                  탭하여 내 변경 vs 동료 변경을 직접 비교·해결하세요
                </Text>
              </View>
              <Text style={{ color: colors.warnText, fontSize: 18, fontWeight: '300' }}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 로그아웃 ── */}
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            style={{
              paddingVertical: 16, backgroundColor: colors.bgBase, borderRadius: 14,
              alignItems: 'center', borderWidth: 1, borderColor: colors.lineDefault,
            }}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#E74C3C', fontWeight: '700', fontSize: 15 }}>{t('auth', 'logout')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 디버그 (DEV 한정) ── */}
        {SENTRY_DEBUG_VISIBLE && (
          <View style={{ marginHorizontal: 16, marginTop: 16, gap: 8 }}>
            <Text style={{ fontSize: 11, color: colors.txTertiary, paddingHorizontal: 4 }}>DEBUG · Sentry</Text>
            <TouchableOpacity
              onPress={() => {
                captureError(new Error('Sentry test — captured exception'), { screen: 'profile', trigger: 'manual_debug_button' });
                Alert.alert('Sentry', 'captureException 호출 완료\n대시보드(Issues)에서 확인하세요.');
              }}
              style={{ paddingVertical: 12, backgroundColor: colors.bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.lineDefault }}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.txPrimary, fontSize: 13, fontWeight: '600' }}>① captureException 테스트</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Sentry', '3초 후 미처리 에러를 발생시킵니다.', [
                  { text: '취소', style: 'cancel' },
                  { text: '진행', style: 'destructive', onPress: () => { setTimeout(() => { throw new Error('Sentry test — unhandled error'); }, 3000); } },
                ]);
              }}
              style={{ paddingVertical: 12, backgroundColor: colors.bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.lineDefault }}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.txPrimary, fontSize: 13, fontWeight: '600' }}>② 미처리 에러 (Crash) 테스트</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  const ev = await Sentry.flush();
                  Alert.alert('Sentry', `flush 완료\n전송 결과: ${ev ? 'OK' : 'timeout/fail'}`);
                } catch (e) {
                  Alert.alert('Sentry', `flush 실패: ${String(e)}`);
                }
              }}
              style={{ paddingVertical: 12, backgroundColor: colors.bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.lineDefault }}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.txPrimary, fontSize: 13, fontWeight: '600' }}>③ 강제 flush</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── 하단 고정 바 ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + 48,
          backgroundColor: colors.bgBase,
          borderTopWidth: 1,
          borderTopColor: colors.lineDefault,
          flexDirection: 'row',
          paddingBottom: insets.bottom,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
          onPress={() => router.push('/notices' as any)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: colors.txPrimary, fontWeight: '600' }}>
            {t('profile', 'notices')}
          </Text>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
        </TouchableOpacity>
        <View style={{ width: 1, backgroundColor: colors.lineStrong, marginVertical: 12 }} />
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.push('/support' as any)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: colors.txPrimary, fontWeight: '600' }}>
            {t('profile', 'support')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
