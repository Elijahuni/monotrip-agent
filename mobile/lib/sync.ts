import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { syncTrips } from '@/lib/local-trips';

/**
 * 네트워크 복원 시 로컬 DB와 백엔드를 자동 동기화하는 훅.
 *
 * CLAUDE.md 오프라인 감지 & 동기화 패턴:
 *   NetInfo.addEventListener → state.isConnected 복원 → syncAll()
 *
 * @returns isOnline — 현재 네트워크 연결 여부
 */
export function useNetworkSync(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  // 이전 상태 추적: 오프라인 → 온라인 전환 시에만 동기화 실행
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      if (online && wasOfflineRef.current) {
        // 오프라인 상태였다가 복원된 경우에만 동기화
        syncAll().catch(() => {/* 조용히 실패 */});
      }
      wasOfflineRef.current = !online;
    });

    return unsubscribe;
  }, []);

  return isOnline;
}

/**
 * 백엔드에서 최신 여행 목록을 가져와 로컬 DB에 반영한다.
 * 네트워크 오류 시 조용히 실패 (로컬 데이터 유지).
 */
export async function syncAll(): Promise<void> {
  try {
    const remote = await api.trips.getAll();
    await syncTrips(remote);
  } catch {
    // 인증 만료 or 네트워크 오류 → 로컬 데이터 유지
  }
}
