import { HapticTab } from '@/components/haptic-tab';
import { OfflineBanner } from '@/components/offline-banner';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import { useAuthStore, useIsOnline } from '@/store';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabLayout() {
  const status = useAuthStore((s) => s.status);
  const isOnline = useIsOnline();
  const colors = useThemedColors();
  const { t } = useSettings();

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
            title: t('tabs', 'home'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: t('tabs', 'explore'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="sparkles" color={color} />,
          }}
        />
        <Tabs.Screen
          name="curated"
          options={{
            title: t('tabs', 'curated'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.circle.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: t('tabs', 'community'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="bubble.left.and.bubble.right.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="saved"
          options={{
            title: t('tabs', 'saved'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs', 'profile'),
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
