import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { create } from 'zustand';

import { syncAll } from '@/lib/sync';

interface NetworkState {
  isOnline: boolean;
  /** 마지막으로 오프라인→온라인으로 전환된 시각 */
  lastReconnectAt: number | null;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  lastReconnectAt: null,
  setOnline(online) {
    const wasOffline = !get().isOnline;
    set({
      isOnline: online,
      lastReconnectAt: online && wasOffline ? Date.now() : get().lastReconnectAt,
    });
  },
}));

/**
 * 앱 루트에서 1회 호출. NetInfo 이벤트를 networkStore와 연동하고,
 * 오프라인→온라인 복원 시 자동 동기화한다.
 */
export function useNetworkListener(): void {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const wasOffline = !useNetworkStore.getState().isOnline;
      useNetworkStore.getState().setOnline(online);

      if (online && wasOffline) {
        syncAll().catch(() => {/* 조용히 실패 */});
      }
    });
    return unsubscribe;
  }, []);
}

/** 화면에서 isOnline만 구독하고 싶을 때 */
export function useIsOnline(): boolean {
  return useNetworkStore((s) => s.isOnline);
}
