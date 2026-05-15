import '../global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { hydrateTripsFromLocal, queryClient } from '@/lib/queries';
import {
  requestNotificationPermission,
  setupNotificationChannel,
  setupNotificationResponseListener,
} from '@/lib/notifications';
import { initSentry, wrap as sentryWrap } from '@/lib/sentry';
import { SettingsProvider } from '@/lib/settings-context';
import { useAuthStore, useNetworkListener } from '@/store';

// Sentry를 앱 최초 로드 시점(모듈 평가 시)에 초기화
// — RootLayout 렌더링 전에 실행되어야 첫 화면부터 에러가 캡처됨
initSentry();

export const unstable_settings = {
  anchor: '(tabs)',
};

const ONBOARDING_KEY = '@triple/onboarding_done';

function InnerLayout() {
  const { colorScheme } = useColorScheme();
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  // undefined = 확인 중 | false = 미완료 | true = 완료
  const [onboardingDone, setOnboardingDone] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    hydrateAuth();
    hydrateTripsFromLocal(queryClient).catch(() => {/* 무시 */});
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setOnboardingDone(val === 'done');
    });

    // 알림 채널 초기화 + 권한 요청 (iOS는 첫 실행 시 팝업, Android는 채널만)
    setupNotificationChannel();
    requestNotificationPermission();

    // 알림 탭 → 해당 여행 화면 열기
    const cleanup = setupNotificationResponseListener((tripId) => {
      // expo-router imperative navigation
      const { router } = require('expo-router');
      router.push(`/trips/${tripId}` as never);
    });
    return cleanup;
  }, [hydrateAuth]);

  useNetworkListener();

  // 온보딩 확인 전 — 스플래시 유지
  if (onboardingDone === undefined) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"     options={{ headerShown: false, title: '홈' }} />
        <Stack.Screen name="auth"       options={{ headerShown: false, title: '로그인' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="modal"      options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="ai"         options={{ headerShown: false, title: 'AI 추천' }} />
        <Stack.Screen name="trips"      options={{ headerShown: false, title: '내 여행' }} />
      </Stack>

      {/* 온보딩 미완료 → /onboarding 으로 리다이렉트 */}
      {!onboardingDone && <Redirect href={'/onboarding' as never} />}

      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* 전역 Toast (항상 최상단) */}
      <Toast />
    </ThemeProvider>
  );
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <InnerLayout />
      </SettingsProvider>
    </QueryClientProvider>
  );
}

// Sentry.wrap이 미처리 JS 에러 + 네이티브 크래시를 자동 캡처
export default sentryWrap(RootLayout);
