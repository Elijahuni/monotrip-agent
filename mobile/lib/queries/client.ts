import { QueryClient } from '@tanstack/react-query';

/**
 * 앱 전역 QueryClient.
 *  - staleTime 30초: 짧은 시간 내 재방문 시 캐시 사용
 *  - retry 1회: 네트워크 오류 시 한 번 재시도, 그 외엔 즉시 실패
 *  - refetchOnWindowFocus: RN에선 의미 없으므로 false
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** 쿼리 키 팩토리 — 일관성 보장 */
export const queryKeys = {
  trips: {
    all: ['trips'] as const,
    detail: (id: number) => ['trips', id] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  ai: {
    recommend: (destination: string, days: number, preferences?: string) =>
      ['ai', 'recommend', destination, days, preferences ?? ''] as const,
  },
  places: (query: string) => ['places', 'search', query] as const,
} as const;
