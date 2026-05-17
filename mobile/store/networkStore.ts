import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { create } from 'zustand';

import { flushMutationQueue } from '@/lib/mutation-queue';
import { syncAll } from '@/lib/sync';

interface NetworkState {
  isOnline: boolean;
  /** 마지막으로 오프라인→온라인으로 전환된 시각 */
  lastReconnectAt: number | null;
  /** mutation queue flush 진행 중 여부 */
  isFlushing: boolean;
  setOnline: (online: boolean) => void;
  setFlushing: (flushing: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  lastReconnectAt: null,
  isFlushing: false,
  setOnline(online) {
    const wasOffline = !get().isOnline;
    set({
      isOnline: online,
      lastReconnectAt: online && wasOffline ? Date.now() : get().lastReconnectAt,
    });
  },
  setFlushing(flushing) {
    set({ isFlushing: flushing });
  },
}));

/**
 * 앱 루트에서 1회 호출. NetInfo 이벤트를 networkStore와 연동하고,
 * 오프라인→온라인 복원 시 자동 동기화 + mutation queue flush를 실행한다.
 */
export function useNetworkListener(): void {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const wasOffline = !useNetworkStore.getState().isOnline;
      useNetworkStore.getState().setOnline(online);

      if (online && wasOffline) {
        // 1) 여행 목록 백그라운드 동기화
        syncAll().catch(() => {/* 조용히 실패 */});

        // 2) 오프라인 중 쌓인 쓰기 작업 순서대로 재실행
        handleReconnect().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);
}

async function handleReconnect(): Promise<void> {
  const { setFlushing } = useNetworkStore.getState();

  // 대기 중인 항목이 있는지 먼저 확인 (없으면 Toast 불필요)
  const { getPendingCount } = await import('@/lib/mutation-queue');
  const count = await getPendingCount();
  if (count === 0) return;

  setFlushing(true);
  try {
    const Toast = (await import('react-native-toast-message')).default;
    Toast.show({
      type: 'info',
      text1: '🔄 오프라인 작업 동기화 중...',
      text2: `${count}개 작업을 서버에 반영하고 있습니다.`,
      visibilityTime: 3000,
      position: 'bottom',
    });

    const result = await flushMutationQueue();

    if (result.flushed > 0) {
      Toast.show({
        type: 'success',
        text1: '✅ 동기화 완료',
        text2: `${result.flushed}개 작업이 서버에 반영되었습니다.`,
        visibilityTime: 3000,
        position: 'bottom',
      });

      // React Query 캐시 무효화 — 서버 반영 후 최신 상태로 갱신
      const { queryClient } = await import('@/lib/queries');
      await queryClient.invalidateQueries();
    }

    if (result.skipped > 0) {
      Toast.show({
        type: 'error',
        text1: '⚠️ 일부 작업 실패',
        text2: `${result.skipped}개 작업을 반영하지 못했습니다.`,
        visibilityTime: 4000,
        position: 'bottom',
      });
    }
  } finally {
    setFlushing(false);
  }
}

/** 화면에서 isOnline만 구독하고 싶을 때 */
export function useIsOnline(): boolean {
  return useNetworkStore((s) => s.isOnline);
}

/** mutation queue flush 진행 중 여부 */
export function useIsFlushing(): boolean {
  return useNetworkStore((s) => s.isFlushing);
}
