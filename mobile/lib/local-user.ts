import { getDB } from '@/lib/database';
import type { UserResponse } from '@/lib/api';

export interface CachedUser {
  user_id: number;
  email: string;
  nickname: string;
  updated_at: string;
}

/**
 * users_cache에서 로컬 유저 정보를 읽는다 (Local-First).
 * 캐시가 없으면 null 반환.
 */
export async function getUserCache(): Promise<CachedUser | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<CachedUser>(
    'SELECT user_id, email, nickname, updated_at FROM users_cache WHERE id = 1',
  );
  return row ?? null;
}

/**
 * 백엔드 /auth/me 응답을 users_cache에 저장(INSERT OR REPLACE).
 */
export async function saveUserCache(user: UserResponse): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO users_cache (id, user_id, email, nickname, access_token, updated_at)
     VALUES (1, ?, ?, ?, '', ?)`,
    [user.id, user.email, user.nickname, new Date().toISOString()],
  );
}
