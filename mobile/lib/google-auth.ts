/**
 * Google OAuth — expo-auth-session 기반.
 *
 * 흐름:
 *  1) useGoogleAuth() 훅 초기화 (login screen에서 호출)
 *  2) promptGoogleLogin() 호출 → 시스템 브라우저에서 Google 로그인
 *  3) id_token 획득 → 백엔드 /auth/google 전송 → triple JWT 발급
 *
 * 설정 필요 (app.json):
 *   {
 *     "expo": {
 *       "plugins": [
 *         ["expo-auth-session", { "scheme": "monotrip" }]
 *       ]
 *     }
 *   }
 *
 * Google Cloud Console 설정:
 *   - OAuth 동의 화면 구성
 *   - iOS/Android/Web 클라이언트 ID 생성
 *   - 환경 변수: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (백엔드 검증용)
 *                EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (iOS 네이티브)
 *                EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (Android 네이티브)
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

// 시스템 브라우저 세션 처리 — iOS에서 필수
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = AuthSession.useAutoDiscovery
  ? undefined
  : {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

const DISCOVERY = AuthSession.useAutoDiscovery?.('https://accounts.google.com');

// 환경 변수 — Expo 공개 변수 (EXPO_PUBLIC_ 접두어)
// 없으면 undefined → 로그인 버튼 비활성화
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

import { Platform } from 'react-native';

function getClientId(): string | undefined {
  if (Platform.OS === 'ios') return IOS_CLIENT_ID || WEB_CLIENT_ID;
  if (Platform.OS === 'android') return ANDROID_CLIENT_ID || WEB_CLIENT_ID;
  return WEB_CLIENT_ID;
}

export class GoogleAuthError extends Error {
  constructor(
    public readonly reason: 'cancel' | 'no_config' | 'no_token' | 'sdk_error',
    cause?: unknown
  ) {
    super(`GoogleAuthError: ${reason}`);
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export interface GoogleAuthResult {
  idToken: string;
}

/**
 * Google 로그인 훅.
 * 반환값의 promptGoogleLogin()을 버튼 onPress에 연결.
 */
export function useGoogleAuth(): {
  promptGoogleLogin: () => Promise<GoogleAuthResult>;
  isConfigured: boolean;
} {
  const clientId = getClientId();
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'monotrip' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? '__placeholder__',
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      usePKCE: false,
    },
    // discovery: 자동 발견 엔드포인트
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    }
  );

  const promptGoogleLogin = async (): Promise<GoogleAuthResult> => {
    if (!clientId) {
      throw new GoogleAuthError('no_config');
    }
    if (!request) {
      throw new GoogleAuthError('sdk_error', 'AuthRequest not ready');
    }

    const result = await promptAsync();

    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new GoogleAuthError('cancel');
    }
    if (result.type === 'error') {
      throw new GoogleAuthError('sdk_error', result.error);
    }
    if (result.type !== 'success') {
      throw new GoogleAuthError('sdk_error', `Unexpected type: ${result.type}`);
    }

    const idToken = result.params?.id_token;
    if (!idToken) {
      throw new GoogleAuthError('no_token', 'id_token not in response params');
    }

    return { idToken };
  };

  return {
    promptGoogleLogin,
    isConfigured: !!clientId,
  };
}
