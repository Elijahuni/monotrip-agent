/**
 * 오프라인 가이드 로컬 캐시 (SQLite)
 *
 * 다운로드한 가이드 상세를 offline_guides 테이블에 보관해
 * 네트워크 없이도 열람할 수 있게 한다. version으로 갱신 여부 판단.
 */
import { getDB } from '@/lib/database';
import type { OfflineGuideDetail } from '@/lib/types';

/** 다운로드(캐시 저장). 같은 id면 덮어쓴다. */
export async function saveCachedGuide(guide: OfflineGuideDetail): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO offline_guides (id, version, data, downloaded_at)
     VALUES (?, ?, ?, ?)`,
    [guide.id, guide.version, JSON.stringify(guide), new Date().toISOString()],
  );
}

/** 캐시된 가이드 상세 조회. 없으면 null. */
export async function getCachedGuide(id: number): Promise<OfflineGuideDetail | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM offline_guides WHERE id = ?',
    [id],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.data) as OfflineGuideDetail;
  } catch {
    return null;
  }
}

/** 다운로드된 가이드 id → version 맵 (목록에서 다운로드/갱신 상태 표시용). */
export async function getCachedVersions(): Promise<Record<number, number>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ id: number; version: number }>(
    'SELECT id, version FROM offline_guides',
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.id] = r.version;
  return map;
}

/** 캐시 삭제(다운로드 취소). */
export async function deleteCachedGuide(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM offline_guides WHERE id = ?', [id]);
}
