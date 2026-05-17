/**
 * 초대 링크 수락 화면 — 카카오톡 등에서 받은 링크로 진입.
 * URL: /trips/invite/<token>
 *
 * UX 원칙: 자동 수락이 아니라 사용자가 명시적으로 "참여하기"를 누른다.
 * (잘못 누른 링크 / 다른 계정으로 로그인된 상태 등을 의식적으로 확인)
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import { useAuthStore } from '@/store';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const me = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setStatus('accepting');
    setErrorMsg(null);
    try {
      await api.collaboration.acceptInvite(token);
      setStatus('done');
      Toast.show({ type: 'success', text1: '여행에 참여했어요!', position: 'bottom' });
      setTimeout(() => router.replace('/'), 800);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(err?.response?.data?.message ?? err?.message ?? '초대 수락에 실패했어요');
      setStatus('error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', padding: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 56 }}>✈️</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.txPrimary, textAlign: 'center' }}>
          여행에 초대받았어요
        </Text>
        <Text style={{ fontSize: 13, color: colors.txSecondary, textAlign: 'center' }}>
          초대를 수락하면 여행 일정을 함께 편집할 수 있어요.{'\n'}
          서로의 변경이 실시간으로 동기화됩니다.
        </Text>

        {me ? (
          <View
            style={{
              marginTop: 8, paddingHorizontal: 14, paddingVertical: 10,
              borderRadius: 12, backgroundColor: colors.bgSurface,
              borderWidth: 1, borderColor: colors.lineDefault,
            }}>
            <Text style={{ fontSize: 11, color: colors.txTertiary }}>참여 계정</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary, marginTop: 2 }}>
              {me.nickname} · {me.email}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: colors.txDanger, marginTop: 4 }}>
            로그인 후 다시 시도해주세요
          </Text>
        )}

        {status === 'idle' || status === 'error' ? (
          <TouchableOpacity
            onPress={accept}
            disabled={!me || !token}
            style={{
              marginTop: 8, paddingHorizontal: 28, paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: !me || !token ? colors.bgStrong : colors.brandPrimary,
              minWidth: 200, alignItems: 'center',
            }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
              {status === 'error' ? '다시 시도' : '참여하기'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {status === 'accepting' ? (
          <View style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={{ fontSize: 12, color: colors.txSecondary }}>참여 중…</Text>
          </View>
        ) : null}

        {status === 'done' ? (
          <Text style={{ color: colors.brandSecondary, fontWeight: '700', marginTop: 8 }}>
            ✓ 참여 완료! 홈으로 이동합니다.
          </Text>
        ) : null}

        {status === 'error' && errorMsg ? (
          <Text style={{ color: colors.txDanger, textAlign: 'center', marginTop: 4 }}>
            {errorMsg}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
