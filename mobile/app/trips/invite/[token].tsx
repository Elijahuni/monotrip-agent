/**
 * 초대 링크 수락 화면 — 카카오톡 등에서 받은 링크로 진입.
 * URL: /trips/invite/<token>
 *
 * UX 원칙: 자동 수락이 아니라 사용자가 명시적으로 "참여하기"를 누른다.
 * (잘못 누른 링크 / 다른 계정으로 로그인된 상태 등을 의식적으로 확인)
 *
 * 공유 흐름:
 *  1) trips/[id]/index.tsx 에서 "친구 초대" 버튼 → createInvite API → share_url 획득
 *  2) shareToKakao() 로 카카오톡 메시지 전송
 *  3) 수신자가 링크 클릭 → 이 화면 진입 → "참여하기" 버튼으로 수락
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import { useAuthStore } from '@/store';

// ── 카카오 SDK 선택적 임포트 ────────────────────────────────────────────────
// Expo Go 환경이나 카카오 네이티브 SDK 미설치 환경에서도 앱이 동작해야 하므로
// 런타임에 require 하고, 실패 시 fallback으로 OS 기본 Share API를 사용한다.
let sendLinkWithSceneParams: ((params: KakaoLinkParams) => Promise<void>) | null = null;

interface KakaoLinkParams {
  templateId: number;
  templateArgs: Record<string, string>;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const kakaoShare = require('@react-native-seoul/kakao-login');
  if (kakaoShare.sendLinkWithSceneParams) {
    sendLinkWithSceneParams = kakaoShare.sendLinkWithSceneParams;
  }
} catch {
  // 카카오 SDK 없음 — 기본 Share API로 폴백
}

// ── 카카오 메시지 템플릿 ID (카카오 디벨로퍼스 콘솔에서 발급 후 설정) ─────────
// 미설정 시 fallback 공유 사용
const KAKAO_TEMPLATE_ID = 0; // TODO: 실제 템플릿 ID 입력 (카카오 디벨로퍼스 → 메시지 → 피드 템플릿)

// ─────────────────────────────────────────────────────────────────────────────

interface TripInviteInfo {
  trip_title: string;
  inviter_nickname: string;
  expires_at: string;
}

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const me = useAuthStore((s) => s.user);

  const [status, setStatus] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<TripInviteInfo | null>(null);
  const [sharing, setSharing] = useState(false);

  // 초대 토큰에서 여행 정보 미리 조회 (선택적 — API 제공 시)
  useEffect(() => {
    if (!token) return;
    api.collaboration
      .getInviteInfo?.(token)
      .then((info: TripInviteInfo) => setInviteInfo(info))
      .catch(() => {
        /* 조회 실패 시 기본 UI 표시 */
      });
  }, [token]);

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

  // ── 카카오톡 공유 ──────────────────────────────────────────────────────────
  const shareToKakao = async (shareUrl: string, tripTitle: string) => {
    setSharing(true);
    try {
      const canUseKakao =
        sendLinkWithSceneParams !== null &&
        KAKAO_TEMPLATE_ID > 0 &&
        Platform.OS !== 'web';

      if (canUseKakao) {
        await sendLinkWithSceneParams!({
          templateId: KAKAO_TEMPLATE_ID,
          templateArgs: {
            trip_title: tripTitle,
            share_url: shareUrl,
            inviter: me?.nickname ?? '친구',
          },
        });
      } else {
        // Fallback: 카카오앱 직접 딥링크 시도 → 실패 시 OS Share Sheet
        const kakaoDeepLink = `kakaolink://send?template_id=${KAKAO_TEMPLATE_ID}&template_args=${encodeURIComponent(
          JSON.stringify({ trip_title: tripTitle, share_url: shareUrl })
        )}`;
        const canOpenKakao = await Linking.canOpenURL(kakaoDeepLink);
        if (canOpenKakao && KAKAO_TEMPLATE_ID > 0) {
          await Linking.openURL(kakaoDeepLink);
        } else {
          // OS 기본 공유 시트 (iMessage, 링크복사 등)
          await Share.share({
            title: `${tripTitle} — 함께 여행 계획 짜요!`,
            message: `✈️ ${me?.nickname ?? '친구'}님이 "${tripTitle}" 여행에 초대했어요!\n\n함께 일정을 만들어봐요: ${shareUrl}`,
            url: shareUrl, // iOS에서 별도 URL 필드로 표시
          });
        }
      }
    } catch (e) {
      Alert.alert('공유 실패', '공유 중 문제가 발생했어요. 링크를 직접 복사해주세요.');
    } finally {
      setSharing(false);
    }
  };

  // ── 초대 링크 생성 후 바로 공유 ────────────────────────────────────────────
  // trips/[id] 화면에서 호출하는 패턴 — 이 화면은 수락 화면이지만,
  // 딥링크로 share 파라미터가 있으면 공유 모드로 동작
  const { share, trip_title: paramTitle } = useLocalSearchParams<{
    share?: string;
    trip_title?: string;
  }>();

  useEffect(() => {
    if (share === '1' && token && paramTitle) {
      // share 모드: 바로 공유 시트 열기
      const shareUrl = `monotrip://trips/invite/${token}`;
      shareToKakao(shareUrl, decodeURIComponent(paramTitle));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTitle = inviteInfo?.trip_title ?? (paramTitle ? decodeURIComponent(paramTitle) : null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 헤더 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.txPrimary }}>
          여행 초대
        </Text>
      </View>

      {/* 본문 */}
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}
      >
        <Text style={{ fontSize: 60 }}>✈️</Text>

        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: colors.txPrimary,
            textAlign: 'center',
          }}
        >
          {displayTitle ? `"${displayTitle}"` : '여행에 초대받았어요'}
        </Text>

        {inviteInfo?.inviter_nickname && (
          <Text style={{ fontSize: 14, color: colors.txSecondary }}>
            {inviteInfo.inviter_nickname}님이 초대했어요
          </Text>
        )}

        <Text
          style={{ fontSize: 13, color: colors.txSecondary, textAlign: 'center', lineHeight: 20 }}
        >
          초대를 수락하면 여행 일정을 함께 편집할 수 있어요.{'\n'}
          서로의 변경이 실시간으로 동기화됩니다.
        </Text>

        {/* 참여 계정 */}
        {me ? (
          <View
            style={{
              marginTop: 4,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.lineDefault,
              width: '100%',
            }}
          >
            <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 2 }}>
              참여할 계정
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary }}>
              {me.nickname} · {me.email}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: colors.txDanger, marginTop: 4 }}>
            로그인 후 다시 시도해주세요
          </Text>
        )}

        {/* 참여 버튼 */}
        {(status === 'idle' || status === 'error') && (
          <TouchableOpacity
            onPress={accept}
            disabled={!me || !token}
            style={{
              marginTop: 8,
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: !me || !token ? colors.bgStrong : colors.brandPrimary,
              minWidth: 220,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
              {status === 'error' ? '다시 시도' : '참여하기'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'accepting' && (
          <View style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={{ fontSize: 12, color: colors.txSecondary }}>참여 중…</Text>
          </View>
        )}

        {status === 'done' && (
          <Text style={{ color: colors.brandSecondary, fontWeight: '700', marginTop: 8 }}>
            ✓ 참여 완료! 홈으로 이동합니다.
          </Text>
        )}

        {status === 'error' && errorMsg && (
          <Text style={{ color: colors.txDanger, textAlign: 'center', marginTop: 4 }}>
            {errorMsg}
          </Text>
        )}

        {/* 카카오톡으로 공유 버튼 (공유 모드가 아닌 일반 진입 시 노출) */}
        {share !== '1' && token && status === 'idle' && (
          <TouchableOpacity
            onPress={() => {
              const shareUrl = `monotrip://trips/invite/${token}`;
              shareToKakao(shareUrl, displayTitle ?? '여행');
            }}
            disabled={sharing}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: '#FEE500', // 카카오 옐로
              marginTop: 4,
            }}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#191919" />
            ) : (
              <Ionicons name="chatbubble" size={18} color="#191919" />
            )}
            <Text style={{ color: '#191919', fontWeight: '700', fontSize: 14 }}>
              카카오톡으로 공유
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── 외부에서 호출하는 공유 유틸 ──────────────────────────────────────────────
// trips/[id]/index.tsx 에서 "친구 초대" 버튼 클릭 시 사용

export async function shareInviteToKakao(params: {
  token: string;
  tripTitle: string;
  inviterNickname: string;
}) {
  const shareUrl = `monotrip://trips/invite/${params.token}`;
  const webFallbackUrl = `https://monotrip.app/trips/invite/${params.token}`;

  const canUseKakao =
    sendLinkWithSceneParams !== null &&
    KAKAO_TEMPLATE_ID > 0 &&
    Platform.OS !== 'web';

  if (canUseKakao) {
    await sendLinkWithSceneParams!({
      templateId: KAKAO_TEMPLATE_ID,
      templateArgs: {
        trip_title: params.tripTitle,
        share_url: webFallbackUrl,
        inviter: params.inviterNickname,
      },
    });
    return;
  }

  // Fallback: OS 기본 공유
  await Share.share({
    title: `${params.tripTitle} — 함께 여행 계획 짜요!`,
    message: `✈️ ${params.inviterNickname}님이 "${params.tripTitle}" 여행에 초대했어요!\n\n함께 일정을 만들어봐요 👉 ${webFallbackUrl}`,
    url: webFallbackUrl,
  });
}
