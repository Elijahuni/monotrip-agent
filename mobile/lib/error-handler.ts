/**
 * 앱 전역 에러 처리 유틸리티.
 *
 * - API 에러(AxiosError) → 사용자 친화적 한/영 메시지로 변환
 * - react-native-toast-message 로 하단 토스트 표시
 * - Alert.alert() 을 남발하던 패턴을 이 모듈로 통일
 */

import { AxiosError } from 'axios';
import Toast from 'react-native-toast-message';

// ─── 공용 토스트 헬퍼 ─────────────────────────────────────────────────────────

export function showSuccess(message: string, title?: string) {
  Toast.show({
    type: 'success',
    text1: title ?? (isKo() ? '완료' : 'Done'),
    text2: message,
    visibilityTime: 2500,
    position: 'bottom',
  });
}

export function showError(message: string, title?: string) {
  Toast.show({
    type: 'error',
    text1: title ?? (isKo() ? '오류' : 'Error'),
    text2: message,
    visibilityTime: 3500,
    position: 'bottom',
  });
}

export function showInfo(message: string, title?: string) {
  Toast.show({
    type: 'info',
    text1: title ?? (isKo() ? '안내' : 'Info'),
    text2: message,
    visibilityTime: 2500,
    position: 'bottom',
  });
}

// ─── API 에러 파싱 ────────────────────────────────────────────────────────────

/** AxiosError 또는 임의의 예외를 받아 사용자 메시지로 변환 후 토스트 표시. */
export function handleApiError(error: unknown, fallback?: string): void {
  const ko = isKo();
  const msg = extractErrorMessage(error, ko, fallback);
  showError(msg);
}

/** AxiosError → 백엔드 message 필드 → HTTP 상태별 기본 메시지 우선순위 추출. */
export function extractErrorMessage(
  error: unknown,
  ko = true,
  fallback?: string,
): string {
  if (error instanceof AxiosError) {
    // 백엔드 표준 응답의 message 필드 우선
    const serverMessage: unknown = error.response?.data?.message;
    if (typeof serverMessage === 'string' && serverMessage && serverMessage !== 'success') {
      return serverMessage;
    }

    // HTTP 상태별 기본 메시지
    const status = error.response?.status;
    if (status === 401) return ko ? '로그인이 필요합니다.' : 'Please log in.';
    if (status === 403) return ko ? '접근 권한이 없습니다.' : 'Access denied.';
    if (status === 404) return ko ? '요청한 정보를 찾을 수 없습니다.' : 'Not found.';
    if (status === 422) return ko ? '입력 내용을 확인해 주세요.' : 'Check your input.';
    if (status === 429) return ko ? '잠시 후 다시 시도해 주세요.' : 'Too many requests. Try again later.';
    if (status && status >= 500) return ko ? '서버 오류가 발생했습니다.' : 'Server error. Try again.';

    // 네트워크 에러 (응답 없음)
    if (!error.response) {
      return ko ? '네트워크 연결을 확인해 주세요.' : 'Check your network connection.';
    }
  }

  return fallback ?? (ko ? '알 수 없는 오류가 발생했습니다.' : 'An unexpected error occurred.');
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/** AsyncStorage 기반 lang 설정 없이 간단히 기기 언어로 판별. */
function isKo(): boolean {
  try {
    // Intl API는 Hermes에서 지원됨
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.startsWith('ko');
  } catch {
    return true; // 기본 한국어
  }
}
