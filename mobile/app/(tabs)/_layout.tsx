import { HapticTab } from '@/components/haptic-tab';
import { OfflineBanner } from '@/components/offline-banner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStoredToken } from '@/lib/api';
import { useNetworkSync } from '@/lib/sync';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isOnline = useNetworkSync();
  // undefined = 확인 중 | null = 미로그인 | string = 로그인됨
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getStoredToken().then(setToken);
  }, []);

  // 토큰 확인 중에는 아무것도 렌더링하지 않음 (스플래시 화면 유지)
  if (token === undefined) return null;

  // 토큰 없으면 로그인 화면으로 리다이렉트
  if (token === null) return <Redirect href="/auth/login" />;

  return (
    <View style={{ flex: 1 }}>
      {/* 오프라인 배너 — Tabs 위, safe area 아래에 고정 */}
      <OfflineBanner isOnline={isOnline} />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3DC3EE',
        tabBarInactiveTintColor: '#9BA7B5',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8ECF2',
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '내 여행',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'AI 추천',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
    </View>
  );
}
