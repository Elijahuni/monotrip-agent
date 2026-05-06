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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!nickname.trim() || !email.trim() || !password) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.auth.register({ nickname: nickname.trim(), email: email.trim(), password });
      // 회원가입 성공 후 자동 로그인
      const token = await api.auth.login({ email: email.trim(), password });
      await saveToken(token.access_token);
      router.replace('/(tabs)');
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? '회원가입에 실패했습니다.')
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
          {/* 타이틀 */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">회원가입</Text>
            <Text className="text-sm text-gray-400 mt-2">
              계정을 만들고 AI 여행 플래너를 시작해보세요
            </Text>
          </View>

          {/* 폼 */}
          <View className="gap-3">
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900"
              placeholder="닉네임"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoComplete="username"
              value={nickname}
              onChangeText={setNickname}
            />
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
              placeholder="비밀번호 (8자 이상)"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
          </View>

          {/* 에러 메시지 */}
          {error ? (
            <Text className="text-red-500 text-sm mt-3 text-center">{error}</Text>
          ) : null}

          {/* 가입 버튼 */}
          <TouchableOpacity
            className="mt-6 bg-blue-500 rounded-2xl py-4 items-center"
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">가입하기</Text>
            )}
          </TouchableOpacity>

          {/* 로그인 링크 */}
          <View className="flex-row justify-center mt-5 gap-1">
            <Text className="text-gray-400 text-sm">이미 계정이 있으신가요?</Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text className="text-blue-500 text-sm font-semibold">로그인</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
