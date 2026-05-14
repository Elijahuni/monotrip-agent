import { api } from '@/lib/api';
import { syncTrips } from '@/lib/local-trips';

// 네트워크 상태 훅은 store/networkStore.ts 로 이동.
// 하위 호환을 위해 useNetworkSync는 useNetworkListener + useIsOnline로 대체되었다.
// 기존 import 경로 호환용 re-export:
export { useNetworkListener as useNetworkSync, useIsOnline } from '@/store/networkStore';

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
