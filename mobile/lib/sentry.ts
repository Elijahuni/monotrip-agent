/**
 * Sentry 초기화 및 유틸리티 (모노트립 모바일)
 *
 * 사용법:
 *   - 앱 진입점(_layout.tsx)에서 `initSentry()` 호출
 *   - 에러 캡처: `captureError(error, { context, extra })`
 *   - 사용자 식별: `setSentryUser(id, email)` — 로그인 후 호출
 *   - 로그아웃 시: `clearSentryUser()`
 */

import * as Sentry from '@sentry/react-native';

const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  'https://94d49886cc49e70eb01a595d27e93f30@o4511404813713408.ingest.us.sentry.io/4511404817907712';

// 개발 빌드에서도 Sentry로 전송하고 싶을 때 (자체 테스트용).
// EXPO_PUBLIC_SENTRY_FORCE_ENABLE=1 로 설정하면 __DEV__에서도 활성화.
const FORCE_ENABLE = process.env.EXPO_PUBLIC_SENTRY_FORCE_ENABLE === '1';

/** 앱 시작 시 한 번 호출. */
export function initSentry(): void {
  Sentry.init({
    dsn: DSN,
    debug: __DEV__,
    enabled: !__DEV__ || FORCE_ENABLE,
    environment: __DEV__ ? (FORCE_ENABLE ? 'dev-test' : 'development') : 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    attachStacktrace: true,
    release: `monotrip@${process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'}`,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      // feedbackIntegration은 v7에서 제거됨 — FeedbackWidget 컴포넌트로 대체
      Sentry.mobileReplayIntegration(),
    ],
  });
}

/** 로그인 완료 후 사용자 컨텍스트 등록. */
export function setSentryUser(id: number, email?: string): void {
  Sentry.setUser({ id: String(id), email });
}

/** 로그아웃 시 사용자 컨텍스트 초기화. */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * 예외를 Sentry로 전송.
 * 이미 처리된 예외(expected errors)에 사용 — 미처리 예외는 SDK가 자동 캡처.
 */
export function captureError(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  if (extras) {
    Sentry.withScope((scope) => {
      Object.entries(extras).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * 커스텀 메시지(breadcrumb)를 Sentry로 전송.
 */
export function captureBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.addBreadcrumb({ message, category, level });
}

/** Sentry React Native wrap — RootLayout export에 적용 */
export const wrap = Sentry.wrap;
