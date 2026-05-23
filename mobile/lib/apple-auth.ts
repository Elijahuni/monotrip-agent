/**
 * Apple Sign In — expo-apple-authentication 기반.
 *
 * iOS 전용 (Android에서는 버튼 자체가 표시되지 않음).
 *
 * 흐름:
 *  1) startAppleLogin() 호출 → 시스템 Apple ID 인증 팝업
 *  2) identityToken + fullName 획득
 *  3) 백엔드 /auth/apple 로 전송 → triple JWT 발급
 *
 * 설치 필요:
 *   npx expo install expo-apple-authentication
 *
 * app.json / app.config.js 설정 필요:
 *   {
 *     "expo": {
 *       "plugins": ["expo-apple-authentication"]
 *     }
 *   }
 *
 * Apple Developer 설정:
 *   Certificates, Identifiers & Profiles → App ID → Capabilities → Sign In with Apple ✓
 */

import { Platform } from 'react-native';

export class AppleAuthError extends Error {
  constructor(
    public readonly reason: 'cancel' | 'not_available' | 'no_token' | 'sdk_error',
    cause?: unknown,
  ) {
    super(`AppleAuthError: ${reason}`);
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export interface AppleAuthResult {
  identityToken: string;
  fullName: string | null;
}

/**
 * Apple Sign In 실행.
 * iOS에서만 호출 가능. Android/Web에서 호출 시 not_available 에러를 던짐.
 *
 * 사용처:
 *   try {
 *     const { identityToken, fullName } = await startAppleLogin();
 *     const token = await api.auth.apple({ identity_token: identityToken, full_name: fullName });
 *     await login(token.access_token, token.refresh_token);
 *   } catch (e) {
 *     if (e instanceof AppleAuthError && e.reason === 'cancel') return;
 *     ...
 *   }
 */
export async function startAppleLogin(): Promise<AppleAuthResult> {
  if (Platform.OS !== 'ios') {
    throw new AppleAuthError('not_available');
  }

  // 동적 require — 패키지가 없는 환경(Android 빌드 등)에서 에러 방지
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let AppleAuthentication: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    AppleAuthentication = require('expo-apple-authentication');
  } catch {
    throw new AppleAuthError('not_available', 'expo-apple-authentication not installed');
  }

  // Apple Sign In 지원 여부 확인 (시뮬레이터에서 비활성화될 수 있음)
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AppleAuthError('not_available', 'Apple Sign In not available on this device');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const identityToken = credential.identityToken;
    if (!identityToken) {
      throw new AppleAuthError('no_token', 'identityToken is null');
    }

    // fullName은 최초 로그인 시에만 전달 (이후 null)
    const givenName = credential.fullName?.givenName ?? '';
    const familyName = credential.fullName?.familyName ?? '';
    const fullName =
      givenName || familyName ? `${familyName}${givenName}`.trim() || null : null;

    return { identityToken, fullName };
  } catch (e: unknown) {
    // Apple Error Code 1001 = 사용자 취소
    if (
      e instanceof Error &&
      'code' in e &&
      (e as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new AppleAuthError('cancel', e);
    }
    throw new AppleAuthError('sdk_error', e);
  }
}

/** iOS에서 Apple Sign In 버튼을 표시할지 여부. */
export const isAppleSignInAvailable = Platform.OS === 'ios';
