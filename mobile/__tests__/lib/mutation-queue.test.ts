/**
 * mutation-queue 의 isNetworkError 판별 로직 테스트.
 *
 * 오프라인 큐잉의 핵심 규칙:
 *  - 응답이 없는(network/timeout/DNS) 오류만 큐잉 대상 → true
 *  - 서버에 도달한 4xx/5xx 는 사용자/요청 문제이므로 큐잉 제외 → false
 *  - Axios 가 아닌 일반 에러도 큐잉 제외 → false
 */
import { AxiosError, AxiosHeaders } from 'axios';

import { isNetworkError } from '@/lib/mutation-queue';

function axiosErrorWithStatus(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as never;
  const response = {
    status,
    statusText: '',
    data: {},
    headers: {},
    config,
  } as never;
  return new AxiosError('failed', String(status), config, {}, response);
}

describe('isNetworkError', () => {
  it('응답이 없는 AxiosError 는 네트워크 오류로 본다', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(isNetworkError(err)).toBe(true);
  });

  it('timeout(ECONNABORTED, 응답 없음) 도 네트워크 오류', () => {
    const err = new AxiosError('timeout', 'ECONNABORTED');
    expect(isNetworkError(err)).toBe(true);
  });

  it('4xx 응답은 네트워크 오류가 아니다', () => {
    expect(isNetworkError(axiosErrorWithStatus(400))).toBe(false);
    expect(isNetworkError(axiosErrorWithStatus(404))).toBe(false);
    expect(isNetworkError(axiosErrorWithStatus(409))).toBe(false);
  });

  it('5xx 응답도 네트워크 오류가 아니다 (서버에 도달함)', () => {
    expect(isNetworkError(axiosErrorWithStatus(500))).toBe(false);
    expect(isNetworkError(axiosErrorWithStatus(503))).toBe(false);
  });

  it('Axios 가 아닌 일반 Error 는 큐잉 대상이 아니다', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });

  it('에러가 아닌 값도 안전하게 false', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('network')).toBe(false);
    expect(isNetworkError({ response: undefined })).toBe(false);
  });
});
