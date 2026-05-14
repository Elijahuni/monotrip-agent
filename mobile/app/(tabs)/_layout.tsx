import { HapticTab } from '@/components/haptic-tab';
import { OfflineBanner } from '@/components/offline-banner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemedColors } from '@/lib/design-tokens';
import { useAuthStore, useIsOnline } from '@/store';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabLayout() {
  const status = useAuthStore((s) => s.status);
  const isOnline = useIsOnline();
  const colors = useThemedColors();

  // 부팅 직후엔 status='loading' — 스플래시 유지
  if (status === 'loading') return null;
  if (status === 'guest') return <Redirect href="/auth/login" />;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner isOnline={isOnline} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.brandPrimary,
          tabBarInactiveTintColor: colors.txTertiary,
          tabBarStyle: {
            backgroundColor: colors.bgSurface,
            borderTopColor: colors.lineDefault,
            borderTopWidth: 1,
            height: 56,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
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
