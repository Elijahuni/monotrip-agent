/**
 * 실시간 협업 — 현재 같은 trip을 보는 사용자 아바타 스택.
 *
 * - 본인은 제외하고 표시 (협업자 인지가 핵심).
 * - 최대 3명까지 아바타. 그 이상은 +N 표시.
 * - 닉네임이 없으면 user_id로 fallback (구 버전 백엔드 호환).
 * - 닉네임 첫 글자를 둥근 배지에 + user_id 해시 기반 결정론적 색상.
 */
import { Text, View } from 'react-native';

import type { PresenceUser } from '@/lib/realtime';

const AVATAR_COLORS = [
  '#FF5A5F', '#FFA940', '#52C41A', '#1890FF',
  '#722ED1', '#EB2F96', '#13C2C2', '#FA8C16',
];

function colorFor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function initialOf(user: PresenceUser): string {
  const n = (user.nickname ?? '').trim();
  if (n.length > 0) return n[0].toUpperCase();
  return String(user.id).slice(-1);
}

interface Props {
  users: PresenceUser[];
  /** 본인 user_id — 표시에서 제외 */
  myUserId: number | null;
  /** 닉네임 정보 없이 user_id만 받았을 때의 fallback 입력 */
  fallbackUserIds?: number[];
  size?: number;
}

export function PresenceStack({ users, myUserId, fallbackUserIds, size = 28 }: Props) {
  // 백엔드가 rich users를 줬으면 그걸 쓰고, 아니면 user_id만 가진 fallback 생성
  const source: PresenceUser[] =
    users.length > 0
      ? users
      : (fallbackUserIds ?? []).map((id) => ({ id, nickname: null }));

  const others = source.filter((u) => u.id !== myUserId);
  if (others.length === 0) return null;

  const visible = others.slice(0, 3);
  const overflow = others.length - visible.length;
  const overlap = Math.round(size * 0.35);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((u, idx) => (
        <View
          key={u.id}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colorFor(u.id),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: idx === 0 ? 0 : -overlap,
            zIndex: visible.length - idx,
          }}
          accessibilityLabel={`함께 보는 사용자 ${u.nickname ?? u.id}`}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.42 }}>
            {initialOf(u)}
          </Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#94A3B8',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -overlap,
          }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.38 }}>
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
