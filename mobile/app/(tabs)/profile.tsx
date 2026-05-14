import { useRouter } from 'expo-router';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { shadow } from '@/lib/design-tokens';
import { useAuthStore } from '@/store';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  const initial = user?.nickname?.charAt(0)?.toUpperCase() ?? 'T';

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-4 pb-4 border-b border-line-default">
        <Text className="text-xl font-bold text-tx-primary">프로필</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5">내 계정 정보</Text>
      </View>

      {/* ── 프로필 카드 ── */}
      <View className="mx-4 mt-4">
        <Card padding="lg">
          <View className="items-center">
            <View
              className="w-20 h-20 rounded-full bg-brand-primary items-center justify-center mb-4"
              style={shadow.fab}>
              <Text className="text-tx-inverse text-3xl font-bold">{initial}</Text>
            </View>
            <Text className="text-lg font-bold text-tx-primary">{user?.nickname ?? '···'}</Text>
            <Text className="text-sm text-tx-tertiary mt-1">{user?.email ?? '···'}</Text>

            <View className="w-full h-px bg-line-default mt-5 mb-5" />

            <View className="w-full gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-tx-secondary">버전</Text>
                <Text className="text-sm font-semibold text-tx-primary">1.0.0</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-tx-secondary">플랫폼</Text>
                <View className="bg-bg-subtle px-2.5 py-1 rounded-full">
                  <Text className="text-xs font-semibold text-tx-secondary">Triple Clone</Text>
                </View>
              </View>
            </View>
          </View>
        </Card>
      </View>

      {/* ── 메뉴 ── */}
      <View className="mx-4 mt-3">
        <Card padding="none" elevation="sm">
          {[
            { label: '공지사항', icon: '📢' },
            { label: '개인정보처리방침', icon: '🔒' },
            { label: '이용약관', icon: '📋' },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.label}
              className={`flex-row items-center px-5 py-4 ${i > 0 ? 'border-t border-line-default' : ''}`}
              activeOpacity={0.7}>
              <Text className="text-base mr-3">{item.icon}</Text>
              <Text className="flex-1 text-sm text-tx-primary">{item.label}</Text>
              <Text className="text-tx-tertiary text-base">›</Text>
            </TouchableOpacity>
          ))}
        </Card>
      </View>

      <View className="mx-4 mt-3">
        <Button label="로그아웃" variant="secondary" onPress={handleLogout} />
      </View>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}
