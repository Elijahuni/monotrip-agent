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
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">프로필</Text>
      </View>

      {/* 프로필 영역 */}
      <View className="flex-1 items-center justify-center gap-4">
        <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center">
          <Text className="text-4xl">✈️</Text>
        </View>
        <Text className="text-lg font-semibold text-gray-900">여행자</Text>
        <Text className="text-sm text-gray-400">트리플 AI 여행 플래너</Text>
      </View>

      {/* 로그아웃 버튼 */}
      <View className="px-6 pb-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <TouchableOpacity
          className="py-4 bg-red-50 rounded-2xl items-center border border-red-100"
          onPress={handleLogout}
          activeOpacity={0.85}>
          <Text className="text-red-500 font-semibold text-base">로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
