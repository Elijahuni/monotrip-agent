/**
 * Trip 공동 편집용 WebSocket 클라이언트.
 *
 * 사용 예:
 *   const conn = await connectTripRealtime(tripId, {
 *     onMessage: (msg) => { ... },
 *     onPresenceChange: (userIds) => { ... },
 *   });
 *   conn.send({ type: 'location_update', op: 'create', payload: {...} });
 *   conn.close();
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '@/lib/api';

export interface PresenceUser {
  id: number;
  nickname: string | null;
}

export type RealtimeMessage =
  | {
      type: 'presence';
      event: 'join' | 'leave';
      user_id: number;
      active_users: number[];
      /** 백엔드 확장 — id+nickname 쌍. 구 버전 백엔드면 undefined */
      active?: PresenceUser[];
    }
  | {
      type: 'location_update';
      op: 'create' | 'patch' | 'delete';
      location_id: number;
      from_user_id?: number;
      payload?: unknown;
    }
  | { type: 'cursor'; payload: unknown; from_user_id?: number }
  | { type: string; [k: string]: unknown };

export interface TripRealtimeHandle {
  send: (msg: Record<string, unknown>) => void;
  close: () => void;
  /** 현재 같은 방에 있는 user_id 목록. presence 메시지 수신 시 갱신됨. */
  activeUsers: () => number[];
}

interface ConnectOptions {
  onMessage?: (msg: RealtimeMessage) => void;
  onPresenceChange?: (userIds: number[], users?: PresenceUser[]) => void;
  onError?: (e: Event) => void;
  onClose?: () => void;
}

function wsBaseUrl(): string {
  const http = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
  return http.replace(/^http/, 'ws');
}

export async function connectTripRealtime(
  tripId: number,
  opts: ConnectOptions = {},
): Promise<TripRealtimeHandle> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error('로그인이 필요합니다');

  const url = `${wsBaseUrl()}/ws/trips/${tripId}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  let active: number[] = [];

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as RealtimeMessage;
      if (msg.type === 'presence' && Array.isArray((msg as { active_users?: unknown }).active_users)) {
        active = (msg as { active_users: number[] }).active_users;
        const richUsers = (msg as { active?: PresenceUser[] }).active;
        opts.onPresenceChange?.(active, Array.isArray(richUsers) ? richUsers : undefined);
      }
      opts.onMessage?.(msg);
    } catch {
      /* malformed payload — ignore */
    }
  };
  ws.onerror = (e) => opts.onError?.(e);
  ws.onclose = () => opts.onClose?.();

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close: () => ws.close(),
    activeUsers: () => active,
  };
}
