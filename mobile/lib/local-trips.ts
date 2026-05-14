import { getDB } from '@/lib/database';
import type { Trip } from '@/lib/types';

/**
 * 로컬 DB에서 전체 여행 목록을 조회한다.
 * CLAUDE.md Local-First: UI가 이 함수를 먼저 호출하고, 이후 API 동기화.
 */
export async function getTrips(): Promise<Trip[]> {
  const db = await getDB();
  return db.getAllAsync<Trip>('SELECT * FROM trips ORDER BY created_at DESC');
}

/**
 * 여행 1건을 로컬 DB에 저장한다.
 * 이미 존재하면 덮어쓴다 (API 동기화 후 upsert 용도).
 */
export async function saveTrip(trip: Trip): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO trips
       (id, user_id, title, description, start_date, end_date, thumbnail_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.id,
      trip.user_id,
      trip.title,
      trip.description ?? null,
      trip.start_date ?? null,
      trip.end_date ?? null,
      trip.thumbnail_url ?? null,
      trip.created_at,
      trip.updated_at,
    ],
  );
}

/**
 * 여행 1건을 로컬 DB에서 삭제한다.
 * PRAGMA foreign_keys = ON 덕분에 연결된 locations도 자동 삭제된다.
 */
export async function deleteTrip(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

/**
 * 서버에서 받아온 여행 목록으로 로컬 DB를 전체 교체한다.
 * 삭제된 여행도 반영되도록 기존 데이터를 지우고 재삽입.
 */
export async function syncTrips(trips: Trip[]): Promise<void> {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM trips');
    for (const trip of trips) {
      await db.runAsync(
        `INSERT INTO trips
           (id, user_id, title, description, start_date, end_date, thumbnail_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trip.id,
          trip.user_id,
          trip.title,
          trip.description ?? null,
          trip.start_date ?? null,
          trip.end_date ?? null,
          trip.thumbnail_url ?? null,
          trip.created_at,
          trip.updated_at,
        ],
      );
    }
  });
}
