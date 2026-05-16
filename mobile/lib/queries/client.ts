import { QueryClient, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { getPendingCount } from '@/lib/mutation-queue';

// ─── staleTime 상수 ─────────────────────────────────────────────────────────
//
// 데이터 특성별로 분리. 각 쿼리 훅에서 이 상수를 import해 오버라이드한다.
//
// │ 분류            │ staleTime │ 이유
// ├─────────────────┼───────────┼──────────────────────────────────────────────
// │ 여행 목록/상세  │ 5분       │ mutation 시 invalidate → TTL은 보조적 역할
// │ 장소 검색       │ 1시간     │ Google Places 데이터 변화 드물, 재검색 비용 큼
// │ 사용자 프로필   │ 10분      │ 로그인 세션 내 거의 안 바뀜
// │ AI 추천 결과    │ 30분      │ 생성 비용 高, 동일 요청 내 결과 변동 없음
// │ 실시간 카운터   │ 0         │ 항상 최신 상태 필요 (대기 중 mutation 수)

export const STALE_TIME = {
  TRIPS:    5  * 60 * 1_000,   //  5분
  PLACES:   60 * 60 * 1_000,   //  1시간
  USER:     10 * 60 * 1_000,   // 10분
  AI:       30 * 60 * 1_000,   // 30분
  REALTIME: 0,
} as const;

// ─── gcTime 상수 ─────────────────────────────────────────────────────────────
// staleTime 만료 후에도 gcTime 동안 메모리에 유지 → 오프라인 복귀 시 즉시 표시.

const GC_TIME = {
  TRIPS:  30 * 60 * 1_000,   // 30분
  PLACES:  5 * 60 * 1_000,   //  5분 (메모리 절약)
  USER:   60 * 60 * 1_000,   //  1시간
  AI:     60 * 60 * 1_000,   //  1시간
} as const;

// ─── retry 정책 ─────────────────────────────────────────────────────────────
// 4xx(클라이언트 오류) → 재시도 무의미. 5xx/네트워크 → 최대 2회.

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AxiosError && error.response) {
    const { status } = error.response;
    if (status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

// ─── QueryClient ────────────────────────────────────────────────────────────

/**
 * 앱 전역 QueryClient — 배포 기준 설정.
 *
 * - staleTime 5분: 쿼리별로 STALE_TIME 상수로 오버라이드
 * - gcTime 30분: staleTime 후에도 오프라인 캐시로 활용
 * - networkMode 'offlineFirst': SQLite hydrate 데이터로 오프라인 즉시 표시
 * - retry: 4xx는 즉시 실패, 5xx/네트워크는 최대 2회 재시도
 * - refetchOnReconnect: 네트워크 복귀 시 자동 갱신
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:             STALE_TIME.TRIPS,
      gcTime:                GC_TIME.TRIPS,
      retry:                 shouldRetry,
      refetchOnWindowFocus:  false,   // React Native에서는 의미 없음
      refetchOnReconnect:    true,    // 온라인 복귀 시 자동 갱신
      refetchOnMount:        true,
      networkMode:           'offlineFirst',
    },
    mutations: {
      retry:       0,
      networkMode: 'offlineFirst',
    },
  },
});

// ─── 쿼리 키 팩토리 ─────────────────────────────────────────────────────────

export const queryKeys = {
  trips: {
    all:    ['trips'] as const,
    detail: (id: number) => ['trips', id] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  ai: {
    recommend: (destination: string, days: number, preferences?: string) =>
      ['ai', 'recommend', destination, days, preferences ?? ''] as const,
    weather: (condition: string) =>
      ['ai', 'weather', condition] as const,
  },
  places: (query: string) => ['places', 'search', query] as const,
} as const;

// ─── 실시간 카운터 훅 ────────────────────────────────────────────────────────

/**
 * 오프라인 중 대기 중인 mutation 개수를 실시간으로 반환.
 * 5초마다 폴링 (온라인 복귀 후 자동 갱신).
 */
export function usePendingCount(): number {
  const { data } = useQuery({
    queryKey:        ['pendingMutations', 'count'],
    queryFn:         getPendingCount,
    refetchInterval: 5_000,
    staleTime:       STALE_TIME.REALTIME,
    gcTime:          60_000,
  });
  return data ?? 0;
}
