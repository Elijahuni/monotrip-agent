import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * DB 싱글턴을 반환한다.
 * 최초 호출 시 DB를 열고 테이블을 생성한다.
 */
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('triple.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');  // 동시 읽기 성능 향상
  await _db.execAsync('PRAGMA foreign_keys = ON;');   // ON DELETE CASCADE 활성화
  await createTables(_db);
  return _db;
}

export async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS trips (
      id           INTEGER PRIMARY KEY,
      user_id      INTEGER NOT NULL,
      title        TEXT    NOT NULL,
      description  TEXT,
      start_date   TEXT,
      end_date     TEXT,
      thumbnail_url TEXT,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id           INTEGER PRIMARY KEY,
      trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      address      TEXT    NOT NULL,
      latitude     REAL    NOT NULL,
      longitude    REAL    NOT NULL,
      category     TEXT    NOT NULL,
      visit_order  INTEGER NOT NULL DEFAULT 0,
      notes        TEXT,
      created_at   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users_cache (
      id           INTEGER PRIMARY KEY DEFAULT 1,
      user_id      INTEGER NOT NULL,
      email        TEXT    NOT NULL,
      nickname     TEXT    NOT NULL,
      access_token TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );

    -- 검색·정렬 성능 향상 인덱스
    CREATE INDEX IF NOT EXISTS idx_trips_created  ON trips(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_user     ON trips(user_id);
    CREATE INDEX IF NOT EXISTS idx_locations_trip ON locations(trip_id);
  `);
}
