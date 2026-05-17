/**
 * 카카오 OAuth — 네이티브 SDK (@react-native-seoul/kakao-login).
 *
 * 흐름:
 *  1) 카카오톡 앱이 깔려있으면 앱간 인증, 아니면 카카오계정 웹뷰
 *  2) SDK가 자동으로 access_token 반환
 *  3) 백엔드 /auth/kakao로 access_token 전송 → 자체 JWT 발급
 *
 * 별도 redirect URI 등록 불필요 — SDK가 내부적으로 처리.
 * 단, 카카오 디벨로퍼스에 iOS bundle ID / Android 패키지명은 반드시 등록.
 */
import { login, logout as kakaoLogout } from '@react-native-seoul/kakao-login';

export interface KakaoAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
  accessTokenExpiresAt: string | null;
}

export class KakaoAuthError extends Error {
  constructor(public readonly reason: 'cancel' | 'no_config' | 'sdk_error', cause?: unknown) {
    super(`KakaoAuthError: ${reason}`);
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

/** 카카오 SDK로 로그인. 사용자 취소/에러 시 KakaoAuthError throw. */
export async function startKakaoLogin(): Promise<KakaoAuthResult> {
  try {
    const result = await login();
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      idToken: result.idToken ?? null,
      accessTokenExpiresAt: result.accessTokenExpiresAt
        ? new Date(result.accessTokenExpiresAt).toISOString()
        : null,
    };
  } catch (e: unknown) {
    // SDK가 던지는 에러 — message에 따라 분류
    const err = e as { message?: string; code?: string };
    const msg = (err.message ?? '').toLowerCase();
    if (msg.includes('cancel') || err.code === 'E_CANCELLED') {
      throw new KakaoAuthError('cancel', e);
    }
    throw new KakaoAuthError('sdk_error', e);
  }
}

/** 카카오 SDK 로그아웃. 자체 JWT 로그아웃은 별도 (useAuthStore.logout). */
export async function kakaoSignOut(): Promise<void> {
  try {
    await kakaoLogout();
  } catch {
    /* 토큰이 없으면 SDK가 에러 — 무시 */
  }
}
