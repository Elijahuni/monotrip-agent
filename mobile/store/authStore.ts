import { create } from 'zustand';

import { api, getStoredToken, saveToken, clearToken, type UserResponse } from '@/lib/api';
import { identify, resetAnalytics, track } from '@/lib/analytics';
import { getUserCache, saveUserCache, type CachedUser } from '@/lib/local-user';
import { clearAllMutations } from '@/lib/mutation-queue';
import { registerPushTokenWithServer, unregisterPushTokenFromServer } from '@/lib/notifications';
import { clearSentryUser, setSentryUser } from '@/lib/sentry';

/**
 * 인증 상태.
 *  - 'loading'      : 앱 부팅 직후, AsyncStorage 토큰 확인 중
 *  - 'authenticated': 토큰 보유 (user는 백그라운드로 채워질 수 있음)
 *  - 'guest'        : 로그아웃 또는 토큰 없음
 */
export type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: CachedUser | null;

  /** 앱 시작 시 1회 호출 — AsyncStorage 토큰 + SQLite user_cache 복원 */
  hydrate: () => Promise<void>;

  /** 로그인 성공 후 호출 — 토큰 저장 + 백그라운드 /auth/me 갱신 */
  login: (accessToken: string, refreshToken: string) => Promise<void>;

  /** 로그아웃 — 토큰 + 캐시 삭제 */
  logout: () => Promise<void>;

  /** /auth/me 다시 가져와 user 갱신 (실패해도 무해) */
  refreshUser: () => Promise<void>;
}

function toCached(u: UserResponse): CachedUser {
  return {
    user_id: u.id,
    email: u.email,
    nickname: u.nickname,
    updated_at: new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  token: null,
  user: null,

  async hydrate() {
    const [token, cached] = await Promise.all([
      getStoredToken(),
      getUserCache(),
    ]);

    if (!token) {
      set({ status: 'guest', token: null, user: null });
      return;
    }

    set({ status: 'authenticated', token, user: cached });

    // 백그라운드로 최신 user 동기화 (네트워크 실패는 무시)
    get().refreshUser().catch(() => {/* offline */});
  },

  async login(accessToken: string, refreshToken: string) {
    await saveToken(accessToken, refreshToken);
    set({ status: 'authenticated', token: accessToken });
    track('login');
    // 로그인 직후 user 채우기
    await get().refreshUser().catch(() => {/* offline */});
    // 로그인 후 Push Token을 서버에 등록 (백그라운드, 실패 무시)
    registerPushTokenWithServer().catch(() => {});
  },

  async logout() {
    // 서버에서 refresh token 전체 폐기 (토큰 유효한 동안 시도)
    await api.auth.logout().catch(() => {});
    await unregisterPushTokenFromServer().catch(() => {});
    await clearToken();
    // 오프라인 큐 초기화 — 다른 유저 세션에 큐가 남지 않도록
    await clearAllMutations().catch(() => {});
    clearSentryUser();
    resetAnalytics();
    set({ status: 'guest', token: null, user: null });
  },

  async refreshUser() {
    const remote = await api.auth.me();
    const cached = toCached(remote);
    await saveUserCache(remote);
    // Sentry에 사용자 ID 등록 (에러 발생 시 어떤 사용자인지 추적)
    setSentryUser(remote.id, remote.email);
    identify(remote.id);
    set({ user: cached });
  },
}));
