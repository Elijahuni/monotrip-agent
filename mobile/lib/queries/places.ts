import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { PlaceSearchResult } from '@/lib/schemas';

import { queryKeys } from './client';

interface UsePlaceSearchOptions {
  /** 디바운스 간격(ms). 기본 300ms */
  debounceMs?: number;
  /** 위치 편향 (현재 위치 또는 trip 중심) */
  near?: { latitude: number; longitude: number } | null;
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * 디바운스된 쿼리 + React Query 캐싱.
 *  - 1자 이하면 fetch 안 함
 *  - 동일 쿼리 30초 캐시 (queryClient 기본 staleTime)
 */
export function usePlaceSearch(rawQuery: string, opts: UsePlaceSearchOptions = {}) {
  const { debounceMs = 300, near = null } = opts;
  const query = useDebounced(rawQuery.trim(), debounceMs);
  const enabled = query.length >= 2;

  return useQuery<PlaceSearchResult[]>({
    queryKey: [
      ...queryKeys.places(query),
      near?.latitude ?? null,
      near?.longitude ?? null,
    ],
    enabled,
    queryFn: () =>
      api.places.search({
        query,
        lat: near?.latitude,
        lng: near?.longitude,
      }),
    // 짧은 입력 변경에도 무거운 API 호출이 누적되지 않도록 retry 0
    retry: 0,
  });
}
