/**
 * Mutation queue가 409 Conflict를 받았을 때, 사용자에게 머지를 요청해야 한다.
 * 이 모듈은 SQLite `pending_conflicts` 테이블로 충돌을 보관하고,
 * 사용자 화면(`/conflicts` 등)에서 "내 변경 유지" vs "서버 값 받아들이기"를 선택하게 한다.
 */
import { getDB } from '@/lib/database';
import type { Location } from '@/lib/types';

export type ConflictType = 'UPDATE_LOCATION';

export interface PendingConflict {
  id: number;
  type: ConflictType;
  trip_id: number;
  entity_id: number;     // location_id
  my_change: Record<string, unknown>;   // 내가 보내려던 변경
  server_state: Partial<Location>;       // 서버에 현재 저장된 상태
  detected_at: string;
}

interface ConflictRow {
  id: number;
  type: string;
  trip_id: number;
  entity_id: number;
  my_change: string;
  server_state: string;
  detected_at: string;
}

export async function ensureConflictsTable(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_conflicts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT    NOT NULL,
      trip_id      INTEGER NOT NULL,
      entity_id    INTEGER NOT NULL,
      my_change    TEXT    NOT NULL,
      server_state TEXT    NOT NULL,
      detected_at  TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conflict_detected ON pending_conflicts(detected_at DESC);
  `);
}

export async function recordConflict(
  c: Omit<PendingConflict, 'id' | 'detected_at'>,
): Promise<void> {
  await ensureConflictsTable();
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO pending_conflicts (type, trip_id, entity_id, my_change, server_state, detected_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      c.type,
      c.trip_id,
      c.entity_id,
      JSON.stringify(c.my_change),
      JSON.stringify(c.server_state),
      new Date().toISOString(),
    ],
  );
}

export async function listConflicts(): Promise<PendingConflict[]> {
  await ensureConflictsTable();
  const db = await getDB();
  const rows = await db.getAllAsync<ConflictRow>(
    'SELECT * FROM pending_conflicts ORDER BY detected_at DESC',
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as ConflictType,
    trip_id: r.trip_id,
    entity_id: r.entity_id,
    my_change: JSON.parse(r.my_change) as Record<string, unknown>,
    server_state: JSON.parse(r.server_state) as Partial<Location>,
    detected_at: r.detected_at,
  }));
}

export async function resolveConflict(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM pending_conflicts WHERE id = ?', [id]);
}

export async function countConflicts(): Promise<number> {
  await ensureConflictsTable();
  const db = await getDB();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM pending_conflicts',
  );
  return row?.cnt ?? 0;
}
