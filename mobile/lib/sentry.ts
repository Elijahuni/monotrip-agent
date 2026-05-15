/**
 * Sentry 초기화 및 유틸리티 (모노트립 모바일)
 *
 * 사용법:
 *   - 앱 진입점(_layout.tsx)에서 `initSentry()` 호출
 *   - 에러 캡처: `captureError(error, { context, extra })`
 *   - 사용자 식별: `setSentryUser(id, email)` — 로그인 후 호출
 *   - 로그아웃 시: `clearSentryUser()`
 *
 * EXPO_PUBLIC_SENTRY_DSN 미설정 시 모든 함수가 no-op 처리되어
 * 개발/테스트 환경에서 추가 설정 없이 동작한다.
 */

import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** 앱 시작 시 한 번 호출. DSN이 없으면 no-op. */
export function initSentry(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    // 개발 중엔 debug 로그 출력, 프로덕션은 조용히
    debug: __DEV__,
    // DSN이 없거나 DEV 환경이면 이벤트 전송 안 함
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // 10% 트랜잭션 성능 추적 (free 5K events 절약)
    tracesSampleRate: 0.1,
    // 개인정보 보호 — 이메일/IP 수집 비활성화
    sendDefaultPii: false,
    // React Native 에러 경계 자동 적용
    attachStacktrace: true,
    // 배포 버전 추적
    release: `monotrip@${process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'}`,
  });
}

/** 로그인 완료 후 사용자 컨텍스트 등록. */
export function setSentryUser(id: number, email?: string): void {
  if (!DSN) return;
  Sentry.setUser({ id: String(id), email });
}

/** 로그아웃 시 사용자 컨텍스트 초기화. */
export function clearSentryUser(): void {
  if (!DSN) return;
  Sentry.setUser(null);
}

/**
 * 예외를 Sentry로 전송.
 * 이미 처리된 예외(expected errors)에 사용 — 미처리 예외는 SDK가 자동 캡처.
 *
 * @param error  - Error 객체 또는 임의 값
 * @param extras - 추가 컨텍스트 (화면명, 사용자 액션 등)
 */
export function captureError(
  error: unknown,
  extras?: Record<string, unknown>,
): void {
  if (!DSN) return;
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
 * 에러 맥락 추적에 유용 (예: "사용자가 여행 삭제 버튼 탭").
 */
export function captureBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  if (!DSN) return;
  Sentry.addBreadcrumb({ message, category, level });
}

/** Sentry React Native wrap — RootLayout export에 적용 */
export const wrap = Sentry.wrap;
