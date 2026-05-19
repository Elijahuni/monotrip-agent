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
  registerPushTokenWithServer,
  requestNotificationPermission,
  setupNotificationChannel,
  setupNotificationResponseListener,
} from '@/lib/notifications';
import { initSentry } from '@/lib/sentry';
import { SettingsProvider } from '@/lib/settings-context';
import { syncAll } from '@/lib/sync';
import { flushMutationQueue, getPendingCount } from '@/lib/mutation-queue';
import { useAuthStore, useNetworkListener } from '@/store';

// Sentry.init()은 lib/sentry.ts의 initSentry()에서만 호출.
// 모듈 최상단 직접 호출 금지:
//   - feedbackIntegration은 현재 SDK에서 제거됨 → 런타임 오류
//   - Sentry.wrap()은 NativeWind JSX interop과 충돌 → hooks 순서 오류
//   - 이중 init 시 이벤트 중복 전송

export const unstable_settings = {
  anchor: '(tabs)',
};

const ONBOARDING_KEY = '@triple/onboarding_done';

function InnerLayout() {
  const { colorScheme } = useColorScheme();
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  // undefined = 확인 중 | false = 미완료 | true = 완료
  const [onboardingDone, setOnboardingDone] = useState<boolean | undefined>(undefined);

  // Sentry 초기화 — 모듈 최상위가 아닌 첫 렌더 시 안전하게 실행
  const sentryInitialized = useRef(false);
  useEffect(() => {
    if (!sentryInitialized.current) {
      initSentry();
      sentryInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    hydrateAuth();

    // 1) 로컬 DB → React Query 캐시 즉시 주입 (오프라인에서도 UI 즉시 표시)
    hydrateTripsFromLocal(queryClient).catch(() => {/* 무시 */});

    // 2) 앱 시작 시 이미 온라인이면 서버 최신 데이터 동기화 + pending mutations flush
    //    (오프라인→온라인 전환은 useNetworkListener가 처리하므로 여기선 시작 시점만 담당)
    (async () => {
      try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        const state = await NetInfo.fetch();
        const online = state.isConnected === true && state.isInternetReachable !== false;
        if (!online) return;

        // 백그라운드 병렬 실행 — UI 블로킹 없음
        syncAll().catch(() => {});

        const count = await getPendingCount();
        if (count > 0) {
          const result = await flushMutationQueue();
          if (result.flushed > 0) {
            // 서버 반영 완료 → React Query 캐시 무효화
            await queryClient.invalidateQueries();
          }
        }
      } catch {
        // 시작 동기화 실패는 조용히 무시 (로컬 데이터로 동작 유지)
      }
    })();

    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setOnboardingDone(val === 'done');
    });

    // 알림 채널 초기화 + 권한 요청 (iOS는 첫 실행 시 팝업, Android는 채널만)
    setupNotificationChannel();
    requestNotificationPermission();

    // 권한 허용 후 Expo Push Token을 서버에 등록 (백그라운드, 실패 무시)
    // — 토큰은 이미 로그인된 상태여야 등록됨 (인증 헤더 필요)
    registerPushTokenWithServer().catch(() => {});

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

// Sentry.wrap은 NativeWind JSX interop과 충돌하여 hooks order 에러 유발 가능
// → wrap 제거. Sentry.init()에서 이미 미처리 예외를 자동 캡처함.
// 네이티브 크래시도 Sentry 네이티브 SDK가 독립적으로 캡처.
export default RootLayout;
