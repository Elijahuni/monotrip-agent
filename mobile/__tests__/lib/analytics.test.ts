/**
 * analytics 래퍼 — 키 미설정(테스트 환경 기본값) 시 no-op 검증.
 *
 * EXPO_PUBLIC_POSTHOG_KEY 가 없으면 track/identify가 네트워크를 호출하지 않고
 * 예외도 던지지 않아야 한다(분석이 앱 흐름을 막지 않는다는 계약).
 */
import { analyticsEnabled, identify, resetAnalytics, track } from '@/lib/analytics';

describe('analytics (no key)', () => {
  beforeEach(() => {
    (global as { fetch?: unknown }).fetch = jest.fn();
  });

  it('키 미설정 시 비활성', () => {
    expect(analyticsEnabled).toBe(false);
  });

  it('track 은 예외 없이 no-op (fetch 미호출)', () => {
    expect(() => track('login', { foo: 'bar' })).not.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('identify / resetAnalytics 도 안전', () => {
    expect(() => identify(42)).not.toThrow();
    expect(() => resetAnalytics()).not.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
