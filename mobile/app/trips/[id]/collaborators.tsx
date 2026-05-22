/**
 * 협업자 관리 화면
 *
 * - 협업자 목록(닉네임 + 역할) 표시
 * - 여행 소유자: 역할 변경(편집 ↔ 보기), 협업자 제거
 * - 소유자/협업자: 새 협업자 초대(카카오 공유)
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { shareInviteToKakao } from '@/app/trips/invite/[token]';
import { ConfirmSheet } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import { useAuthStore } from '@/store';

interface Collaborator {
  user_id: number;
  role: string;
  joined_at: string;
  nickname: string | null;
}

export default function CollaboratorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();
  const myUserId = useAuthStore((s) => s.user?.user_id ?? null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [tripTitle, setTripTitle] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Collaborator | null>(null);

  const isOwner = ownerId !== null && ownerId === myUserId;

  const load = useCallback(async () => {
    try {
      const [trip, list] = await Promise.all([
        api.trips.getOne(tripId),
        api.collaboration.listCollaborators(tripId),
      ]);
      setOwnerId(trip.user_id);
      setTripTitle(trip.title);
      setCollaborators(list);
    } catch {
      Toast.show({
        type: 'error',
        text1: lang === 'ko' ? '협업자 정보를 불러오지 못했어요' : 'Failed to load',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  }, [tripId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleRole(c: Collaborator) {
    const next = c.role === 'edit' ? 'view' : 'edit';
    setBusyId(c.user_id);
    try {
      await api.collaboration.updateCollaboratorRole(tripId, c.user_id, next);
      setCollaborators((prev) =>
        prev.map((x) => (x.user_id === c.user_id ? { ...x, role: next } : x)),
      );
    } catch {
      Toast.show({ type: 'error', text1: lang === 'ko' ? '역할 변경 실패' : 'Update failed', visibilityTime: 2000 });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    const c = removeTarget;
    if (!c) return;
    setBusyId(c.user_id);
    try {
      await api.collaboration.removeCollaborator(tripId, c.user_id);
      setCollaborators((prev) => prev.filter((x) => x.user_id !== c.user_id));
      setRemoveTarget(null);
    } catch {
      Toast.show({ type: 'error', text1: lang === 'ko' ? '제거 실패' : 'Remove failed', visibilityTime: 2000 });
    } finally {
      setBusyId(null);
    }
  }

  async function handleInvite() {
    try {
      const { token } = await api.collaboration.createInvite(tripId, 'edit');
      const me = useAuthStore.getState().user;
      await shareInviteToKakao({
        token,
        tripTitle: tripTitle.trim() || (lang === 'ko' ? '여행' : 'Trip'),
        inviterNickname: me?.nickname ?? (lang === 'ko' ? '친구' : 'Friend'),
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      Alert.alert(err?.response?.data?.message ?? (lang === 'ko' ? '초대 링크 생성 실패' : 'Invite failed'));
    }
  }

  function roleLabel(role: string): string {
    if (role === 'view') return lang === 'ko' ? '보기' : 'View';
    if (role === 'owner') return lang === 'ko' ? '소유자' : 'Owner';
    return lang === 'ko' ? '편집' : 'Edit';
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      {/* 헤더 */}
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
          {lang === 'ko' ? '함께하는 사람들' : 'Collaborators'}
        </Text>
        <TouchableOpacity
          onPress={handleInvite}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.coral500, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 }}
        >
          <Ionicons name="person-add-outline" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
            {lang === 'ko' ? '초대' : 'Invite'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : (
        <FlatList
          data={collaborators}
          keyExtractor={(c) => String(c.user_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14, textAlign: 'center' }}>
                {lang === 'ko'
                  ? '아직 협업자가 없어요.\n초대 버튼으로 친구를 초대해보세요.'
                  : 'No collaborators yet.\nUse Invite to add friends.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgSurface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.lineDefault,
              }}
            >
              {/* 아바타 (이니셜) */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: palette.coral500,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  {(item.nickname ?? 'U').charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* 이름 + 역할 */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.txPrimary, fontWeight: '600', fontSize: 15 }}>
                  {item.nickname ?? `${lang === 'ko' ? '사용자' : 'User'} #${item.user_id}`}
                </Text>
                <Text style={{ color: colors.txTertiary, fontSize: 12, marginTop: 2 }}>
                  {roleLabel(item.role)}
                </Text>
              </View>

              {/* 소유자 전용 액션 */}
              {isOwner && item.user_id !== ownerId && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {busyId === item.user_id ? (
                    <ActivityIndicator color={palette.coral500} size="small" />
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={() => handleToggleRole(item)}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong }}
                      >
                        <Text style={{ color: colors.txSecondary, fontSize: 12, fontWeight: '600' }}>
                          {item.role === 'edit'
                            ? (lang === 'ko' ? '보기로' : 'To view')
                            : (lang === 'ko' ? '편집으로' : 'To edit')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRemoveTarget(item)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}

      <ConfirmSheet
        visible={removeTarget !== null}
        title={lang === 'ko' ? '협업자 제거' : 'Remove collaborator'}
        message={
          removeTarget
            ? lang === 'ko'
              ? `${removeTarget.nickname ?? `#${removeTarget.user_id}`} 님을 협업자에서 제거할까요?`
              : `Remove ${removeTarget.nickname ?? `#${removeTarget.user_id}`} from this trip?`
            : undefined
        }
        confirmLabel={lang === 'ko' ? '제거' : 'Remove'}
        cancelLabel={lang === 'ko' ? '취소' : 'Cancel'}
        destructive
        loading={busyId !== null}
        onConfirm={confirmRemove}
        onClose={() => setRemoveTarget(null)}
      />
    </View>
  );
}
