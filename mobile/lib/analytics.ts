/**
 * 제품 분석 — PostHog Capture HTTP API 경량 래퍼.
 *
 * 네이티브 SDK 대신 capture 엔드포인트로 직접 전송(Expo Go 호환, 의존성 0).
 * EXPO_PUBLIC_POSTHOG_KEY 미설정 시 모든 호출이 no-op → 개발/테스트 안전.
 *
 * 사용:
 *   identify(userId)        // 로그인 시 1회
 *   track('trip_created')   // 이벤트
 *   resetAnalytics()        // 로그아웃 시
 */

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// 현재 distinct_id (로그인 사용자 ID 또는 익명). 메모리 보관.
let distinctId = 'anonymous';

export const analyticsEnabled = !!POSTHOG_KEY;

/** 로그인 시 사용자 식별. 이후 이벤트가 이 user에 귀속된다. */
export function identify(userId: number | string): void {
  distinctId = String(userId);
  if (!POSTHOG_KEY) return;
  void capture('$identify', { $set: { identified_at: new Date().toISOString() } });
}

/** 로그아웃 시 익명으로 초기화. */
export function resetAnalytics(): void {
  distinctId = 'anonymous';
}

/** 이벤트 전송. 키 미설정/네트워크 오류는 조용히 무시(분석은 앱 흐름을 막지 않음). */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!POSTHOG_KEY) return;
  void capture(event, properties);
}

async function capture(event: string, properties: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: 'triple-mobile' },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    /* 분석 전송 실패는 무시 */
  }
}
