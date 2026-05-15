/**
 * 푸시 알림 모듈 (expo-notifications 기반).
 *
 * [로컬 알림] 서버 없이 디바이스에서 D-day 알림 스케줄링.
 * [서버 알림] Expo Push Token을 백엔드에 등록 → 서버가 일괄 발송.
 *
 * 로컬 + 서버 이중 전송 방지를 위해:
 *   - 로컬 알림: 앱이 설치된 기기의 로컬 스케줄 (오프라인 지원)
 *   - 서버 알림: 앱이 꺼져있을 때 / 여러 기기 지원
 *
 * 서버 알림 등록 흐름:
 *   1. requestNotificationPermission() → 권한 허용
 *   2. getExpoPushToken()              → ExponentPushToken[xxx] 획득
 *   3. registerPushTokenWithServer()   → POST /notifications/push-token
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── 알림 채널 설정 (Android) ─────────────────────────────────────────────────

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trip-reminders', {
      name: '여행 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5A5F',
    });
  }
}

// ─── 권한 요청 ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── 여행 알림 스케줄링 ───────────────────────────────────────────────────────

interface TripNotificationParams {
  tripId: number;
  tripTitle: string;
  startDate: string; // ISO date string "2026-06-15"
}

/**
 * 여행 출발일 기준 D-7, D-3, D-1, D-0 알림 등록.
 * 기존 같은 여행 알림은 먼저 취소하고 재등록한다.
 */
export async function scheduleTripNotifications(params: TripNotificationParams): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const { tripId, tripTitle, startDate } = params;

  // 기존 알림 취소 후 재등록
  await cancelTripNotifications(tripId);

  const departure = new Date(startDate);
  departure.setHours(8, 0, 0, 0); // 오전 8시 알림

  const now = new Date();

  const schedule: Array<{ daysOffset: number; title: string; body: string }> = [
    { daysOffset: -7, title: '✈️ 여행 준비 알림', body: `${tripTitle} 출발 7일 전! 짐 체크리스트 확인해보세요.` },
    { daysOffset: -3, title: '🗺 여행 D-3', body: `${tripTitle} 출발 3일 전! 일정을 최종 확인하세요.` },
    { daysOffset: -1, title: '🎒 내일 출발!', body: `${tripTitle} 내일 출발이에요! 준비물 마지막 체크!` },
    { daysOffset:  0, title: '🎉 오늘 출발!', body: `오늘 ${tripTitle} 출발일이에요! 즐거운 여행 되세요.` },
  ];

  for (const item of schedule) {
    const triggerDate = new Date(departure);
    triggerDate.setDate(triggerDate.getDate() + item.daysOffset);

    // 과거 시각이면 스킵
    if (triggerDate <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `trip-${tripId}-d${item.daysOffset}`,
      content: {
        title: item.title,
        body: item.body,
        data: { tripId, type: 'trip_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
}

/** 해당 여행의 모든 알림 취소 (삭제/날짜 변경 시). */
export async function cancelTripNotifications(tripId: number): Promise<void> {
  const offsets = [-7, -3, -1, 0];
  await Promise.all(
    offsets.map((d) =>
      Notifications.cancelScheduledNotificationAsync(`trip-${tripId}-d${d}`).catch(() => {}),
    ),
  );
}

// ─── 서버 사이드 푸시 알림 — Expo Push Token 관리 ────────────────────────────

/**
 * Expo Push Token을 획득한다.
 * - 시뮬레이터 또는 projectId 미설정 시 null 반환 (silent fail).
 * - ExponentPushToken[xxx] 형식의 문자열 반환.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // projectId: app.json > extra.eas.projectId 또는 환경변수
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId as string | undefined ??
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    if (!projectId) {
      // EAS 프로젝트 ID 없이는 Expo Push Token 발급 불가 (개발 환경에서는 정상)
      console.log('[notifications] No EAS projectId — skipping push token registration');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data; // "ExponentPushToken[xxx]"
  } catch (err) {
    // 시뮬레이터, 권한 없음, 네트워크 오류 등 → 무시
    console.warn('[notifications] getExpoPushToken failed:', err);
    return null;
  }
}

/**
 * 알림 권한 획득 후 Push Token을 서버에 등록한다.
 * 네트워크 오류나 토큰 발급 실패는 무시 (로컬 알림은 계속 동작).
 */
export async function registerPushTokenWithServer(): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const token = await getExpoPushToken();
    if (!token) return;

    // api를 직접 import하면 순환 import 위험이 있으므로 dynamic import
    const { api } = await import('@/lib/api');
    await api.notifications.registerToken(token);
  } catch (err) {
    // 서버 등록 실패해도 로컬 알림은 정상 동작
    console.warn('[notifications] registerPushTokenWithServer failed:', err);
  }
}

/**
 * 로그아웃 또는 알림 권한 거부 시 서버에서 토큰을 제거한다.
 */
export async function unregisterPushTokenFromServer(): Promise<void> {
  try {
    const { api } = await import('@/lib/api');
    await api.notifications.unregisterToken();
  } catch {
    // 실패 무시 (이미 로그아웃 상태이거나 토큰 없음)
  }
}

// ─── 알림 응답 리스너 ─────────────────────────────────────────────────────────

/** 앱 시작 시 알림 응답 리스너 설정. */
export function setupNotificationResponseListener(
  onTripOpen: (tripId: number) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { tripId?: number };
    if (data?.tripId) {
      onTripOpen(data.tripId);
    }
  });
  return () => sub.remove();
}
