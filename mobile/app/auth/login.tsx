import { AxiosError } from 'axios';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, saveToken } from '@/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const token = await api.auth.login({ email: email.trim(), password });
      await saveToken(token.access_token);
      router.replace('/(tabs)');
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? '로그인에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled">
        <View
          className="flex-1 px-6 justify-center"
          style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
          {/* 로고 / 타이틀 */}
          <View className="items-center mb-10">
            <Text className="text-5xl mb-3">✈️</Text>
            <Text className="text-3xl font-bold text-gray-900">트리플</Text>
            <Text className="text-sm text-gray-400 mt-1">AI 여행 플래너</Text>
          </View>

          {/* 폼 */}
          <View className="gap-3">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900"
              placeholder="이메일"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900"
              placeholder="비밀번호"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {/* 에러 메시지 */}
          {error ? (
            <Text className="text-red-500 text-sm mt-3 text-center">{error}</Text>
          ) : null}

          {/* 로그인 버튼 */}
          <TouchableOpacity
            className="mt-6 bg-blue-500 rounded-2xl py-4 items-center"
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">로그인</Text>
            )}
          </TouchableOpacity>

          {/* 회원가입 링크 */}
          <View className="flex-row justify-center mt-5 gap-1">
            <Text className="text-gray-400 text-sm">아직 계정이 없으신가요?</Text>
            <Link href="/auth/register" asChild>
              <TouchableOpacity>
                <Text className="text-blue-500 text-sm font-semibold">회원가입</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
