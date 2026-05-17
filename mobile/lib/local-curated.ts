/**
 * 큐레이션 SQLite 캐시 (오프라인 읽기 + 첫 화면 즉시 표시).
 *
 * 캐시 전략:
 *  - 키: city + category + vibes(정렬·콤마) + women_friendly
 *  - TTL: 24시간 (큐레이션 데이터는 휘발성 낮음)
 *  - 사용: 화면에서 먼저 캐시 read → 즉시 표시 → 백엔드 fetch → 캐시 갱신
 */
import type { CuratedPlace } from '@/lib/types';
import { getDB } from '@/lib/database';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface CuratedFilterKey {
  city: string;
  category?: string;
  vibes?: string[];
  womenFriendly?: boolean;
}

export function buildCacheKey(f: CuratedFilterKey): string {
  const vibes = (f.vibes ?? []).slice().sort().join(',');
  return [
    f.city,
    f.category ?? '',
    vibes,
    f.womenFriendly ? 'women' : '',
  ].join('|');
}

/** 캐시 히트면 CuratedPlace[], 미스/만료면 null. */
export async function readCuratedCache(
  filter: CuratedFilterKey,
): Promise<CuratedPlace[] | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ data: string; cached_at: string }>(
      'SELECT data, cached_at FROM curated_cache WHERE cache_key = ? LIMIT 1',
      [buildCacheKey(filter)],
    );
    if (!row) return null;
    const age = Date.now() - new Date(row.cached_at).getTime();
    if (age > TTL_MS) return null;
    return JSON.parse(row.data) as CuratedPlace[];
  } catch (e) {
    if (__DEV__) console.warn('[local-curated] read failed', e);
    return null;
  }
}

export async function writeCuratedCache(
  filter: CuratedFilterKey,
  items: CuratedPlace[],
): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT OR REPLACE INTO curated_cache (cache_key, city, data, cached_at)
       VALUES (?, ?, ?, ?)`,
      [
        buildCacheKey(filter),
        filter.city,
        JSON.stringify(items),
        new Date().toISOString(),
      ],
    );
  } catch (e) {
    if (__DEV__) console.warn('[local-curated] write failed', e);
  }
}

/** 도시 단위 캐시 삭제 (관리자/디버그용). */
export async function clearCuratedCache(city?: string): Promise<void> {
  const db = await getDB();
  if (city) {
    await db.runAsync('DELETE FROM curated_cache WHERE city = ?', [city]);
  } else {
    await db.runAsync('DELETE FROM curated_cache');
  }
}
