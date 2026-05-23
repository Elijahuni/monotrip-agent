/**
 * 햅틱 피드백 헬퍼 — expo-haptics 안전 래퍼.
 *
 * 웹/미지원 기기에서 예외가 나지 않도록 try/catch로 감싼다.
 * 화면 곳곳에서 일관된 강도로 호출하기 위한 단순 API.
 */
import * as Haptics from 'expo-haptics';

/** 가벼운 탭(칩 선택, 아코디언 토글, 카드 진입). */
export function tapLight(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* 미지원 — 무시 */
  }
}

/** 중간 강도(주요 액션 버튼, 새로고침 트리거). */
export function tapMedium(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* 무시 */
  }
}

/** 성공 알림(쿠폰 발급, 저장 완료). */
export function notifySuccess(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* 무시 */
  }
}

/** 경고/오류 알림(파괴적 액션 확정, 실패). */
export function notifyWarning(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* 무시 */
  }
}
