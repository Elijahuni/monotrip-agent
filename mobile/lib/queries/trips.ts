import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type TripCreateRequest, type TripDetail, type TripPage } from '@/lib/api';
import { deleteTrip, getTrips, saveTrip, syncTrips } from '@/lib/local-trips';
import { enqueueMutation, isNetworkError } from '@/lib/mutation-queue';
import type { Location, Trip } from '@/lib/types';

import { STALE_TIME, queryKeys } from './client';

/**
 * 트립 목록 — cursor 기반 무한 스크롤 (Local-First).
 *  - 첫 페이지 로드 시 SQLite 캐시를 미러링
 *  - getNextPageParam: next_cursor → 다음 페이지 커서 전달
 *  - 네트워크 실패 시 캐시 유지
 */
export function useTrips() {
  return useInfiniteQuery<TripPage, Error>({
    queryKey: queryKeys.trips.all,
    initialPageParam: undefined as number | undefined,
    staleTime: STALE_TIME.TRIPS,
    async queryFn({ pageParam }) {
      const cursor = pageParam as number | undefined;
      const page = await api.trips.getAll({ limit: 20, cursor });
      // 첫 페이지만 SQLite에 미러링
      if (!cursor) {
        await syncTrips(page.items);
      }
      return page;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

/** 트립 상세 — locations 포함 */
export function useTrip(tripId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    enabled,
    staleTime: STALE_TIME.TRIPS,
    async queryFn() {
      const data = await api.trips.getOne(tripId);
      await saveTrip(data);
      return data;
    },
  });
}

/** 앱 부팅 시 SQLite 캐시를 React Query에 hydrate */
export async function hydrateTripsFromLocal(qc: QueryClient): Promise<void> {
  const local = await getTrips();
  if (local.length > 0) {
    // 첫 페이지 형태로 주입
    qc.setQueryData(queryKeys.trips.all, {
      pages: [{ items: local, next_cursor: null, has_more: false }],
      pageParams: [undefined],
    });
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TripCreateRequest) => api.trips.create(body),
    async onSuccess(trip) {
      await saveTrip(trip);
      await qc.invalidateQueries({ queryKey: queryKeys.trips.all });
    },
    async onError(err, body) {
      if (isNetworkError(err)) {
        await enqueueMutation('CREATE_TRIP', { body });
      }
    },
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<TripCreateRequest> }) =>
      api.trips.update(id, body),
    async onSuccess(trip) {
      await saveTrip(trip);
      await qc.invalidateQueries({ queryKey: queryKeys.trips.all });
      qc.setQueryData<TripDetail>(queryKeys.trips.detail(trip.id), trip);
    },
    async onError(err, { id, body }) {
      if (isNetworkError(err)) {
        await enqueueMutation('UPDATE_TRIP', { tripId: id, body });
      }
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn(id: number) {
      await api.trips.remove(id);
      await deleteTrip(id);
      return id;
    },
    async onSuccess(id) {
      await qc.invalidateQueries({ queryKey: queryKeys.trips.all });
      qc.removeQueries({ queryKey: queryKeys.trips.detail(id) });
    },
    async onError(err, id) {
      if (isNetworkError(err)) {
        // 로컬에서는 이미 삭제 처리하고 서버 동기화만 큐잉
        await deleteTrip(id);
        await qc.invalidateQueries({ queryKey: queryKeys.trips.all });
        await enqueueMutation('DELETE_TRIP', { tripId: id });
      }
    },
  });
}

export function useDuplicateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tripId: number) => api.trips.duplicate(tripId),
    async onSuccess(trip) {
      await saveTrip(trip);
      await qc.invalidateQueries({ queryKey: queryKeys.trips.all });
    },
    // 복제는 오프라인 큐잉 불필요 (로컬에서 수행 불가)
  });
}

// ─── Location Mutations ────────────────────────────────────────────────────────

interface CreateLocationVars {
  tripId: number;
  body: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    category: string;
    visit_order: number;
    notes?: string | null;
  };
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, body }: CreateLocationVars) => api.locations.create(tripId, body),
    onSuccess(loc, { tripId }) {
      qc.setQueryData<TripDetail>(queryKeys.trips.detail(tripId), (prev) =>
        prev ? { ...prev, locations: [...(prev.locations ?? []), loc] } : prev,
      );
    },
    async onError(err, { tripId, body }) {
      if (isNetworkError(err)) {
        await enqueueMutation('CREATE_LOCATION', { tripId, body });
      }
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    async mutationFn({ tripId, locationId }: { tripId: number; locationId: number }) {
      await api.locations.remove(tripId, locationId);
      return { tripId, locationId };
    },
    onSuccess({ tripId, locationId }) {
      qc.setQueryData<TripDetail>(queryKeys.trips.detail(tripId), (prev) =>
        prev
          ? { ...prev, locations: (prev.locations ?? []).filter((l: Location) => l.id !== locationId) }
          : prev,
      );
    },
    async onError(err, { tripId, locationId }) {
      if (isNetworkError(err)) {
        // 로컬 캐시에서 먼저 제거 (오프라인 UX)
        qc.setQueryData<TripDetail>(queryKeys.trips.detail(tripId), (prev) =>
          prev
            ? { ...prev, locations: (prev.locations ?? []).filter((l: Location) => l.id !== locationId) }
            : prev,
        );
        await enqueueMutation('DELETE_LOCATION', { tripId, locationId });
      }
    },
  });
}
