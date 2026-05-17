import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

import { countConflicts } from '@/lib/conflicts';
import { shadow } from '@/lib/design-tokens';
import { captureError } from '@/lib/sentry';
import { useSettings } from '@/lib/settings-context';
import { useAuthStore } from '@/store';

const SENTRY_DEBUG_VISIBLE =
  __DEV__ || process.env.EXPO_PUBLIC_SENTRY_FORCE_ENABLE === '1';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, isDark, toggleDark, lang, toggleLang } = useSettings();
  const [conflictCount, setConflictCount] = useState(0);

  // 화면 진입 시마다 충돌 카운트 갱신 (mutation queue flush 결과 반영)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      countConflicts().then((n) => { if (!cancelled) setConflictCount(n); }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

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

  const initial = user?.nickname?.charAt(0)?.toUpperCase() ?? 'T';

  const bgBase    = isDark ? '#0D0D18' : '#FFFFFF';
  const bgSurface = isDark ? '#13131F' : '#F8FAFB';
  const bgSubtle  = isDark ? '#1E1E2E' : '#F0F4F8';
  const txPrimary = isDark ? '#E8EEF4' : '#1A2E44';
  const txSecond  = isDark ? '#9BA7B5' : '#5A6474';
  const txTertiary= isDark ? '#6B7785' : '#9BA7B5';
  const borderC   = isDark ? '#2A2A3E' : '#E8ECF2';
  const cardShadow = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }
    : shadow.card;

  return (
    <View style={{ flex: 1, backgroundColor: bgSurface, paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View style={{ backgroundColor: bgBase, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: borderC }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: txPrimary }}>{t('profile', 'title')}</Text>
        <Text style={{ fontSize: 12, color: txTertiary, marginTop: 2 }}>{t('profile', 'subtitle')}</Text>
      </View>

      {/* ── 프로필 카드 ── */}
      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: bgBase, borderRadius: 20, padding: 24, alignItems: 'center', ...cardShadow }}>
        <View
          style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF5A5F', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            shadowColor: '#FF5A5F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{initial}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: txPrimary }}>{user?.nickname ?? '···'}</Text>
        <Text style={{ fontSize: 13, color: txTertiary, marginTop: 4 }}>{user?.email ?? '···'}</Text>

        <View style={{ width: '100%', height: 1, backgroundColor: borderC, marginTop: 20, marginBottom: 20 }} />

        <View style={{ width: '100%', gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: txSecond }}>{t('common', 'version')}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: txPrimary }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: txSecond }}>{t('common', 'platform')}</Text>
            <View style={{ backgroundColor: bgSubtle, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: txSecond }}>Triple Clone</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── 설정 카드 ── */}
      <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: bgBase, borderRadius: 20, overflow: 'hidden', ...cardShadow }}>
        {/* 언어 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text style={{ fontSize: 16, marginRight: 12 }}>🌐</Text>
          <Text style={{ flex: 1, fontSize: 14, color: txPrimary }}>{t('profile', 'language')}</Text>
          <TouchableOpacity onPress={toggleLang} activeOpacity={0.8}
            style={{ flexDirection: 'row', borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FF5A5F' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: lang === 'ko' ? '#FF5A5F' : bgSubtle }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: lang === 'ko' ? '#fff' : txTertiary }}>한국어</Text>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: lang === 'en' ? '#FF5A5F' : bgSubtle }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: lang === 'en' ? '#fff' : txTertiary }}>EN</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 다크 모드 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: borderC }}>
          <Text style={{ fontSize: 16, marginRight: 12 }}>{isDark ? '🌙' : '☀️'}</Text>
          <Text style={{ flex: 1, fontSize: 14, color: txPrimary }}>{t('profile', 'darkMode')}</Text>
          <Switch
            value={isDark}
            onValueChange={toggleDark}
            trackColor={{ false: '#E8ECF2', true: '#FF5A5F' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* 메뉴 */}
        {([
          { labelKey: 'notices' as const, icon: '📢' },
          { labelKey: 'privacy'  as const, icon: '🔒' },
          { labelKey: 'terms'    as const, icon: '📋' },
        ]).map((item) => (
          <TouchableOpacity
            key={item.labelKey}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: borderC }}
            activeOpacity={0.7}>
            <Text style={{ fontSize: 16, marginRight: 12 }}>{item.icon}</Text>
            <Text style={{ flex: 1, fontSize: 14, color: txPrimary }}>{t('profile', item.labelKey)}</Text>
            <Text style={{ color: txTertiary, fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 동기화 충돌 (있을 때만) ── */}
      {conflictCount > 0 ? (
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => router.push('/conflicts')}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 14, paddingHorizontal: 16,
              borderRadius: 14, backgroundColor: '#FFF1E6', borderWidth: 1, borderColor: '#FFB07A',
            }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#7A3700' }}>
                동기화 충돌 {conflictCount}건
              </Text>
              <Text style={{ fontSize: 11, color: '#9A5A2A', marginTop: 2 }}>
                탭하여 내 변경 vs 동료 변경을 직접 비교·해결하세요
              </Text>
            </View>
            <Text style={{ color: '#7A3700', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── 로그아웃 ── */}
      <View style={{ marginHorizontal: 16, marginTop: 12 }}>
        <TouchableOpacity
          style={{ paddingVertical: 16, backgroundColor: bgBase, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
          onPress={handleLogout}
          activeOpacity={0.85}>
          <Text style={{ color: '#E74C3C', fontWeight: '700', fontSize: 15 }}>{t('auth', 'logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── 디버그 (개발/베타 빌드 한정) ── */}
      {SENTRY_DEBUG_VISIBLE ? (
        <View style={{ marginHorizontal: 16, marginTop: 16, gap: 8 }}>
          <Text style={{ fontSize: 11, color: txTertiary, paddingHorizontal: 4 }}>DEBUG · Sentry</Text>
          <TouchableOpacity
            onPress={() => {
              captureError(new Error('Sentry test — captured exception'), {
                screen: 'profile',
                trigger: 'manual_debug_button',
              });
              Alert.alert('Sentry', 'captureException 호출 완료\n대시보드(Issues)에서 확인하세요.');
            }}
            style={{ paddingVertical: 12, backgroundColor: bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
            activeOpacity={0.85}>
            <Text style={{ color: txPrimary, fontSize: 13, fontWeight: '600' }}>① captureException 테스트</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Sentry', '3초 후 미처리 에러를 발생시킵니다.\n(자동 캡처 확인용)', [
                { text: '취소', style: 'cancel' },
                {
                  text: '진행',
                  style: 'destructive',
                  onPress: () => {
                    setTimeout(() => {
                      throw new Error('Sentry test — unhandled error');
                    }, 3000);
                  },
                },
              ]);
            }}
            style={{ paddingVertical: 12, backgroundColor: bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
            activeOpacity={0.85}>
            <Text style={{ color: txPrimary, fontSize: 13, fontWeight: '600' }}>② 미처리 에러 (Crash) 테스트</Text>
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
            style={{ paddingVertical: 12, backgroundColor: bgBase, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
            activeOpacity={0.85}>
            <Text style={{ color: txPrimary, fontSize: 13, fontWeight: '600' }}>③ 강제 flush</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 10, color: txTertiary, paddingHorizontal: 4 }}>
            DEV에서 이벤트 전송하려면 .env.local에 EXPO_PUBLIC_SENTRY_FORCE_ENABLE=1 추가
          </Text>
        </View>
      ) : null}

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}
