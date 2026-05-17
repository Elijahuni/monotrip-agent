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
      id            INTEGER PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      destination   TEXT,
      description   TEXT,
      start_date    TEXT,
      end_date      TEXT,
      thumbnail_url TEXT,
      total_budget  INTEGER,
      group_size    INTEGER NOT NULL DEFAULT 1,
      share_token   TEXT,
      created_at    TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id                 INTEGER PRIMARY KEY,
      trip_id            INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name               TEXT    NOT NULL,
      address            TEXT    NOT NULL,
      latitude           REAL    NOT NULL,
      longitude          REAL    NOT NULL,
      category           TEXT    NOT NULL,
      visit_order        INTEGER NOT NULL DEFAULT 0,
      day_index          INTEGER NOT NULL DEFAULT 1,
      notes              TEXT,
      phone              TEXT,
      opening_hours      TEXT,
      estimated_minutes  INTEGER,
      budget_per_person  INTEGER,
      website            TEXT,
      rating             REAL,
      images             TEXT,
      google_place_id    TEXT,
      created_at         TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users_cache (
      id           INTEGER PRIMARY KEY DEFAULT 1,
      user_id      INTEGER NOT NULL,
      email        TEXT    NOT NULL,
      nickname     TEXT    NOT NULL,
      access_token TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS destination_guides (
      destination  TEXT    PRIMARY KEY,
      data         TEXT    NOT NULL,
      cached_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_places (
      id                 INTEGER PRIMARY KEY,
      user_id            INTEGER NOT NULL,
      name               TEXT    NOT NULL,
      address            TEXT    NOT NULL,
      latitude           REAL    NOT NULL,
      longitude          REAL    NOT NULL,
      category           TEXT    NOT NULL DEFAULT '관광지',
      notes              TEXT,
      google_place_id    TEXT,
      rating             REAL,
      images             TEXT,
      website            TEXT,
      phone              TEXT,
      estimated_minutes  INTEGER,
      created_at         TEXT    NOT NULL
    );

    -- 오프라인 Mutation Queue
    -- 네트워크 오류 시 쓰기 작업을 여기에 보관 → 온라인 복귀 시 순차 재시도
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,  -- 'CREATE_TRIP' | 'UPDATE_TRIP' | 'DELETE_TRIP' 등
      payload     TEXT    NOT NULL,  -- JSON 직렬화된 파라미터
      created_at  TEXT    NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT               -- 마지막 실패 메시지 (디버깅용)
    );

    -- 큐레이션 캐시 (도시별 결과를 직렬화해 저장. 오프라인 읽기 전용)
    CREATE TABLE IF NOT EXISTS curated_cache (
      cache_key   TEXT    PRIMARY KEY,  -- 예: "tokyo|cafe|빈티지,감성|women"
      city        TEXT    NOT NULL,
      data        TEXT    NOT NULL,     -- JSON.stringify(CuratedPlace[])
      cached_at   TEXT    NOT NULL
    );

    -- 검색·정렬 성능 향상 인덱스 (day_index 의존 인덱스는 마이그레이션 이후 생성)
    CREATE INDEX IF NOT EXISTS idx_curated_city       ON curated_cache(city);
    CREATE INDEX IF NOT EXISTS idx_trips_created      ON trips(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trips_user         ON trips(user_id);
    CREATE INDEX IF NOT EXISTS idx_locations_trip     ON locations(trip_id);
    CREATE INDEX IF NOT EXISTS idx_saved_user         ON saved_places(user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_created    ON pending_mutations(created_at ASC);
  `);

  // 기존 DB 마이그레이션: 누락 컬럼 추가 (이미 있으면 에러 무시)
  const migrations = [
    "ALTER TABLE trips ADD COLUMN destination TEXT",
    "ALTER TABLE trips ADD COLUMN total_budget INTEGER",
    "ALTER TABLE trips ADD COLUMN group_size INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE trips ADD COLUMN share_token TEXT",
    "ALTER TABLE locations ADD COLUMN day_index INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE locations ADD COLUMN phone TEXT",
    "ALTER TABLE locations ADD COLUMN opening_hours TEXT",
    "ALTER TABLE locations ADD COLUMN estimated_minutes INTEGER",
    "ALTER TABLE locations ADD COLUMN budget_per_person INTEGER",
    "ALTER TABLE locations ADD COLUMN website TEXT",
    "ALTER TABLE locations ADD COLUMN rating REAL",
    "ALTER TABLE locations ADD COLUMN images TEXT",
    "ALTER TABLE locations ADD COLUMN google_place_id TEXT",
    // day_index 컬럼 추가 후 인덱스 생성 (컬럼 없는 기존 DB에서 먼저 실행되면 crash)
    "CREATE INDEX IF NOT EXISTS idx_locations_day ON locations(trip_id, day_index)",
    // 오프라인 Mutation Queue — 기존 DB 마이그레이션
    `CREATE TABLE IF NOT EXISTS pending_mutations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      payload     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT
    )`,
    "CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_mutations(created_at ASC)",
    // 큐레이션 캐시 — 기존 DB 마이그레이션
    `CREATE TABLE IF NOT EXISTS curated_cache (
      cache_key   TEXT    PRIMARY KEY,
      city        TEXT    NOT NULL,
      data        TEXT    NOT NULL,
      cached_at   TEXT    NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_curated_city ON curated_cache(city)",
  ];
  for (const sql of migrations) {
    try { await db.execAsync(sql); } catch { /* 컬럼이 이미 있으면 무시 */ }
  }
}
