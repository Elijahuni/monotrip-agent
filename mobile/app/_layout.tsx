import '../global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { hydrateTripsFromLocal, queryClient } from '@/lib/queries';
import { SettingsProvider } from '@/lib/settings-context';
import { useAuthStore, useNetworkListener } from '@/store';

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
  }, [hydrateAuth]);

  useNetworkListener();

  // 온보딩 확인 전 — 스플래시 유지
  if (onboardingDone === undefined) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"     options={{ headerShown: false }} />
        <Stack.Screen name="auth"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="modal"      options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="ai"         options={{ headerShown: false }} />
      </Stack>

      {/* 온보딩 미완료 → /onboarding 으로 리다이렉트 */}
      {!onboardingDone && <Redirect href={'/onboarding' as never} />}

      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <InnerLayout />
      </SettingsProvider>
    </QueryClientProvider>
  );
}
