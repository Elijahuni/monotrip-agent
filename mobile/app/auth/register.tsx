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
      className="flex-1 bg-bg-base"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View
          className="flex-1 px-6"
          style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}>

          {/* ── 상단 뒤로가기 & 타이틀 ── */}
          <Link href="/auth/login" asChild>
            <TouchableOpacity className="mb-8 self-start" activeOpacity={0.7}>
              <Text className="text-triple-blue text-base font-semibold">← 로그인으로</Text>
            </TouchableOpacity>
          </Link>

          <View className="mb-8">
            <Text className="text-2xl font-bold text-tx-primary tracking-tight">회원가입</Text>
            <Text className="text-sm text-tx-tertiary mt-2">
              계정을 만들고 AI 여행 플래너를 시작해보세요
            </Text>
          </View>

          {/* ── 입력 폼 ── */}
          <View className="gap-3">
            <View>
              <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">닉네임</Text>
              <TextInput
                className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary"
                placeholder="여행 닉네임"
                placeholderTextColor="#9BA7B5"
                autoCapitalize="none"
                autoComplete="username"
                value={nickname}
                onChangeText={(t) => { setNickname(t); if (error) setError(''); }}
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">이메일</Text>
              <TextInput
                className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary"
                placeholder="example@email.com"
                placeholderTextColor="#9BA7B5"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(t) => { setEmail(t); if (error) setError(''); }}
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">
                비밀번호 <Text className="text-tx-tertiary font-normal">(8자 이상)</Text>
              </Text>
              <TextInput
                className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary"
                placeholder="비밀번호를 입력해주세요"
                placeholderTextColor="#9BA7B5"
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
                onSubmitEditing={handleRegister}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* 에러 */}
          {error ? (
            <View className="mt-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
              <Text className="text-negative text-sm text-center">{error}</Text>
            </View>
          ) : null}

          {/* 가입 버튼 */}
          <TouchableOpacity
            className="mt-6 bg-triple-blue rounded-xl py-4 items-center"
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-tx-inverse font-bold text-base">가입하기</Text>
            )}
          </TouchableOpacity>

          {/* 로그인 링크 */}
          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-tx-tertiary text-sm">이미 계정이 있으신가요?</Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity>
                <Text className="text-triple-blue text-sm font-semibold">로그인</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
