/**
 * 로컬 푸시 알림 모듈 (expo-notifications 기반).
 *
 * 서버 없이 디바이스 로컬에서 여행 D-day 알림을 스케줄링한다.
 * 여행 생성/수정 시 scheduleTripNotifications()를 호출하면 된다.
 *
 * 알림 트리거:
 *   - D-7: "✈️ {제목} 출발 7일 전! 짐 체크 해봤나요?"
 *   - D-3: "🗺 {제목} 출발 3일 전! 일정 최종 확인하세요."
 *   - D-1: "🎒 {제목} 내일 출발! 준비물 마지막 체크!"
 *   - D-0: "🎉 오늘 {제목} 출발일이에요! 즐거운 여행 되세요."
 */

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
