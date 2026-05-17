import { AxiosError } from 'axios';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { shadow } from '@/lib/design-tokens';
import { KakaoAuthError, startKakaoLogin } from '@/lib/kakao-auth';
import { useAuthStore } from '@/store';
import { TouchableOpacity } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleKakaoLogin() {
    setError('');
    setLoading(true);
    try {
      // 네이티브 SDK로 access_token 직접 수령
      const { accessToken } = await startKakaoLogin();
      // 백엔드에 access_token 전달 → 자체 JWT 발급
      const token = await api.auth.kakao({ access_token: accessToken });
      await login(token.access_token, token.refresh_token);
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof KakaoAuthError) {
        if (e.reason === 'cancel') {
          /* 사용자 취소 — 조용히 무시 */
        } else {
          setError('카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
      } else {
        const msg = e instanceof AxiosError
          ? (e.response?.data?.detail ?? '카카오 로그인에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
        setError(typeof msg === 'string' ? msg : '카카오 로그인 실패');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const token = await api.auth.login({ email: email.trim(), password });
      await login(token.access_token, token.refresh_token);
      router.replace('/(tabs)');
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '로그인에 실패했습니다.')
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
          className="flex-1 px-6 justify-center"
          style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }}>

          {/* ── 로고 ── */}
          <View className="items-center mb-12">
            <View
              className="w-16 h-16 rounded-2xl bg-brand-primary items-center justify-center mb-4"
              style={shadow.fab}>
              <Text className="text-white text-3xl font-bold">T</Text>
            </View>
            <Text className="text-2xl font-bold text-tx-primary tracking-tight">트리플</Text>
            <Text className="text-sm text-tx-tertiary mt-1">AI 여행 플래너</Text>
          </View>

          {/* ── 입력 폼 ── */}
          <View className="gap-3">
            <TextField
              label="이메일"
              placeholder="example@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={(t) => { setEmail(t); if (error) setError(''); }}
            />
            <TextField
              label="비밀번호"
              placeholder="비밀번호를 입력해주세요"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={(t) => { setPassword(t); if (error) setError(''); }}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {error ? (
            <View className="mt-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
              <Text className="text-state-danger text-sm text-center">{error}</Text>
            </View>
          ) : null}

          <View className="mt-6">
            <Button label="로그인" onPress={handleLogin} loading={loading} />
          </View>

          {/* 구분선 */}
          <View className="flex-row items-center my-6 gap-3">
            <View className="flex-1 h-px bg-line-default" />
            <Text className="text-tx-tertiary text-xs">또는</Text>
            <View className="flex-1 h-px bg-line-default" />
          </View>

          {/* 카카오 로그인 */}
          <TouchableOpacity
            onPress={handleKakaoLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#FEE500',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 12,
            }}>
            <Text style={{ color: '#191919', fontSize: 15, fontWeight: '800' }}>
              💬 카카오로 시작하기
            </Text>
          </TouchableOpacity>

          {/* 회원가입 버튼 */}
          <Link href="/auth/register" asChild>
            <View>
              <Button label="새 계정 만들기" variant="secondary" onPress={() => router.push('/auth/register')} />
            </View>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
