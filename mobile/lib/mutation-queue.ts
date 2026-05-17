/**
 * 오프라인 Mutation Queue
 *
 * 네트워크 오류로 실패한 쓰기 작업을 SQLite에 보관하고,
 * 온라인 복귀 시 순서대로 재실행한다.
 *
 * 설계 원칙:
 *  - 네트워크 오류(응답 없음)만 큐잉 — 4xx/5xx는 사용자 실수이므로 제외
 *  - last-write-wins: 같은 trip을 UPDATE 후 DELETE 하면 DELETE가 이김
 *  - 최대 3회 재시도 후 failed 처리 (큐에 남겨두고 건너뜀)
 *  - 큐는 FIFO (created_at ASC) 순서로 처리
 *
 * 지원 mutation 타입:
 *  CREATE_TRIP | UPDATE_TRIP | DELETE_TRIP
 *  CREATE_LOCATION | UPDATE_LOCATION | DELETE_LOCATION
 */

import { AxiosError } from 'axios';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { recordConflict } from '@/lib/conflicts';
import { getDB } from '@/lib/database';
import type { Location } from '@/lib/types';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type MutationType =
  | 'CREATE_TRIP'
  | 'UPDATE_TRIP'
  | 'DELETE_TRIP'
  | 'CREATE_LOCATION'
  | 'UPDATE_LOCATION'
  | 'DELETE_LOCATION';

export interface PendingMutation {
  id: number;
  type: MutationType;
  payload: Record<string, unknown>;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

export interface FlushResult {
  flushed: number;   // 성공적으로 재실행된 수
  skipped: number;   // 최대 재시도 초과로 건너뛴 수
  remaining: number; // 아직 남은 항목 수 (재시도 한계 내)
}

const MAX_RETRIES = 3;

// ─── 큐 CRUD ─────────────────────────────────────────────────────────────────

/** 오프라인 쓰기 작업을 큐에 추가 */
export async function enqueueMutation(
  type: MutationType,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO pending_mutations (type, payload, created_at)
     VALUES (?, ?, ?)`,
    [type, JSON.stringify(payload), new Date().toISOString()],
  );
}

/** 전체 대기 중인 mutation 목록 조회 (FIFO 순) */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    id: number;
    type: string;
    payload: string;
    created_at: string;
    retry_count: number;
    last_error: string | null;
  }>('SELECT * FROM pending_mutations ORDER BY created_at ASC');

  return rows.map((r) => ({
    id: r.id,
    type: r.type as MutationType,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    created_at: r.created_at,
    retry_count: r.retry_count,
    last_error: r.last_error,
  }));
}

/** 성공한 mutation 삭제 */
export async function removeMutation(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [id]);
}

/** 실패한 mutation 재시도 카운트 증가 */
async function incrementRetry(id: number, error: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE pending_mutations
     SET retry_count = retry_count + 1, last_error = ?
     WHERE id = ?`,
    [error, id],
  );
}

/** 대기 중인 mutation 개수 (UI 배지용) */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM pending_mutations WHERE retry_count < ?',
    [MAX_RETRIES],
  );
  return row?.cnt ?? 0;
}

/** 모든 pending mutation 삭제 (로그아웃 시) */
export async function clearAllMutations(): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM pending_mutations');
}

// ─── 네트워크 오류 판별 ────────────────────────────────────────────────────────

/**
 * 에러가 네트워크 오류(응답 없음)인지 판별.
 * 4xx / 5xx 는 서버에 도달한 것이므로 큐잉 대상이 아님.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof AxiosError) {
    // response가 없으면 timeout, 연결 거부, DNS 실패 등
    return !err.response;
  }
  return false;
}

// ─── Flush (온라인 복귀 시 재실행) ───────────────────────────────────────────

/**
 * 대기 중인 모든 mutation을 순서대로 재실행한다.
 *
 * - 성공: 큐에서 제거
 * - 네트워크 여전히 불안정: retry_count 증가, 다음 기회에 재시도
 * - 서버 4xx 오류: retry_count += 1 (최대 3회까지), 이후 영구 스킵
 * - 최대 재시도 초과: 건너뜀 (skipped 카운트)
 */
export async function flushMutationQueue(): Promise<FlushResult> {
  const mutations = await getPendingMutations();
  if (mutations.length === 0) return { flushed: 0, skipped: 0, remaining: 0 };

  // api는 dynamic import — 순환 의존성 방지
  const { api } = await import('@/lib/api');

  let flushed = 0;
  let skipped = 0;

  for (const mutation of mutations) {
    // 최대 재시도 초과 → 스킵
    if (mutation.retry_count >= MAX_RETRIES) {
      skipped++;
      continue;
    }

    try {
      await executeMutation(api, mutation);
      await removeMutation(mutation.id);
      flushed++;
    } catch (err) {
      // 409 Conflict — 다른 사용자가 먼저 수정. 충돌 큐로 이관 후 mutation은 큐에서 제거.
      // (재시도해도 같은 결과이므로 사용자 결정 필요)
      if (err instanceof AxiosError && err.response?.status === 409) {
        const detail = err.response.data?.detail as
          | { code?: string; current?: Partial<Location> }
          | undefined;
        if (detail?.code === 'version_conflict' && mutation.type === 'UPDATE_LOCATION') {
          await recordConflict({
            type: 'UPDATE_LOCATION',
            trip_id: mutation.payload.tripId as number,
            entity_id: mutation.payload.locationId as number,
            my_change: mutation.payload.body as Record<string, unknown>,
            server_state: detail.current ?? {},
          });
          await removeMutation(mutation.id);
          Toast.show({
            type: 'error',
            text1: '동기화 충돌 발생',
            text2: '탭하여 해결 → 동료가 먼저 수정한 항목이 있어요',
            position: 'top',
            visibilityTime: 5000,
            onPress: () => {
              Toast.hide();
              try { router.push('/conflicts'); } catch { /* navigation 컨텍스트 미준비 — 무시 */ }
            },
          });
          continue;
        }
      }

      const msg = err instanceof Error ? err.message : String(err);
      await incrementRetry(mutation.id, msg);

      // 네트워크가 여전히 불안정하면 더 이상 시도하지 않음 (순서 보장)
      if (isNetworkError(err)) break;
    }
  }

  const remaining = await getPendingCount();
  return { flushed, skipped, remaining };
}

// ─── 내부: mutation 타입별 API 실행 ──────────────────────────────────────────

async function executeMutation(
  api: (typeof import('@/lib/api'))['api'],
  mutation: PendingMutation,
): Promise<void> {
  const p = mutation.payload;

  switch (mutation.type) {
    case 'CREATE_TRIP':
      await api.trips.create(p.body as Parameters<typeof api.trips.create>[0]);
      break;

    case 'UPDATE_TRIP':
      await api.trips.update(
        p.tripId as number,
        p.body as Parameters<typeof api.trips.update>[1],
      );
      break;

    case 'DELETE_TRIP':
      await api.trips.remove(p.tripId as number);
      break;

    case 'CREATE_LOCATION':
      await api.locations.create(
        p.tripId as number,
        p.body as Parameters<typeof api.locations.create>[1],
      );
      break;

    case 'UPDATE_LOCATION':
      await api.locations.update(
        p.tripId as number,
        p.locationId as number,
        p.body as Parameters<typeof api.locations.update>[2],
        // 큐잉 시점에 알고 있던 version을 If-Match로 전송 (없으면 검증 생략)
        p.expectedVersion !== undefined ? { expectedVersion: p.expectedVersion as number } : undefined,
      );
      break;

    case 'DELETE_LOCATION':
      await api.locations.remove(p.tripId as number, p.locationId as number);
      break;

    default:
      throw new Error(`Unknown mutation type: ${(mutation as PendingMutation).type}`);
  }
}
