import { useRouter } from 'expo-router';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearToken } from '@/lib/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function handleLogout() {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-4 pb-4 border-b border-line-default">
        <Text className="text-xl font-bold text-tx-primary">프로필</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5">내 계정 정보</Text>
      </View>

      {/* ── 프로필 카드 ── */}
      <View className="mx-4 mt-4 bg-bg-base rounded-2xl p-6 items-center"
        style={{ shadowColor: '#1A2E44', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
        {/* 아바타 */}
        <View className="w-20 h-20 rounded-full bg-triple-blue items-center justify-center mb-4"
          style={{ shadowColor: '#3DC3EE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
          <Text className="text-tx-inverse text-3xl font-bold">T</Text>
        </View>

        <Text className="text-lg font-bold text-tx-primary">여행자</Text>
        <Text className="text-sm text-tx-tertiary mt-1">트리플 AI 여행 플래너</Text>

        {/* 구분선 */}
        <View className="w-full h-px bg-line-default mt-5 mb-5" />

        {/* 앱 정보 */}
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

      {/* ── 메뉴 ── */}
      <View className="mx-4 mt-3 bg-bg-base rounded-2xl overflow-hidden"
        style={{ shadowColor: '#1A2E44', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
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
      </View>

      {/* ── 로그아웃 ── */}
      <View className="mx-4 mt-3">
        <TouchableOpacity
          className="py-4 bg-bg-base rounded-2xl items-center border border-line-default"
          onPress={handleLogout}
          activeOpacity={0.85}>
          <Text className="text-negative font-semibold text-base">로그아웃</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}
