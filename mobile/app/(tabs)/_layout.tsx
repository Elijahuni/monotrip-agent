import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStoredToken } from '@/lib/api';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // undefined = 확인 중 | null = 미로그인 | string = 로그인됨
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getStoredToken().then(setToken);
  }, []);

  // 토큰 확인 중에는 아무것도 렌더링하지 않음 (스플래시 화면 유지)
  if (token === undefined) return null;

  // 토큰 없으면 로그인 화면으로 리다이렉트
  // Redirect는 라우트 컴포넌트 내부에서 호출되므로 네비게이터가 이미 초기화된 상태
  if (token === null) return <Redirect href="/auth/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'AI 추천',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
