import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type TripCreateRequest, type TripDetail } from '@/lib/api';
import { deleteTrip, getTrips, saveTrip, syncTrips } from '@/lib/local-trips';
import type { Location, Trip } from '@/lib/types';

import { queryKeys } from './client';

/**
 * 트립 목록 — Local-First.
 *  - initialData: SQLite 캐시를 즉시 반환 (마운트 시 깜빡임 제거)
 *  - queryFn: 백엔드 호출 후 SQLite에 미러링
 *  - 네트워크 실패 시 캐시 유지
 */
export function useTrips() {
  return useQuery({
    queryKey: queryKeys.trips.all,
    async queryFn() {
      const remote = await api.trips.getAll();
      await syncTrips(remote);
      return remote;
    },
    // SQLite 로딩 후 적용. React Query는 동기 initialData만 받으므로
    // 화면 마운트 시 별도 hydrate 헬퍼를 통해 setQueryData(...) 한다.
  });
}

/** 트립 상세 — locations 포함 */
export function useTrip(tripId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    enabled,
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
    qc.setQueryData<Trip[]>(queryKeys.trips.all, local);
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TripCreateRequest) => api.trips.create(body),
    async onSuccess(trip) {
      await saveTrip(trip);
      qc.setQueryData<Trip[]>(queryKeys.trips.all, (prev) =>
        prev ? [trip, ...prev] : [trip],
      );
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
      qc.setQueryData<Trip[]>(queryKeys.trips.all, (prev) =>
        prev ? prev.map((t) => (t.id === trip.id ? { ...t, ...trip } : t)) : prev,
      );
      qc.setQueryData<TripDetail>(queryKeys.trips.detail(trip.id), trip);
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
    onSuccess(id) {
      qc.setQueryData<Trip[]>(queryKeys.trips.all, (prev) =>
        prev ? prev.filter((t) => t.id !== id) : prev,
      );
      qc.removeQueries({ queryKey: queryKeys.trips.detail(id) });
    },
  });
}

export function useDuplicateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tripId: number) => api.trips.duplicate(tripId),
    async onSuccess(trip) {
      await saveTrip(trip);
      qc.setQueryData<Trip[]>(queryKeys.trips.all, (prev) =>
        prev ? [trip, ...prev] : [trip],
      );
    },
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
  });
}
