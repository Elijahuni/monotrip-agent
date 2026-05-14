import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center p-5 bg-white">
      <Text className="text-2xl font-bold text-gray-900">Modal</Text>
      <Link href="/" dismissTo className="mt-4 py-3">
        <Text className="text-blue-500 text-base">홈으로 돌아가기</Text>
      </Link>
    </View>
  );
}
