/**
 * 충돌 해결 화면 — 409 Conflict로 보류된 변경 목록 + 머지 결정.
 *
 * 각 충돌마다 3가지 선택:
 *  - "내 변경 유지": 서버 최신 version으로 다시 PATCH (강제 덮어쓰기)
 *  - "서버 값 받기": 내 변경 폐기, 충돌 제거
 *  - "건너뛰기": 다음에 결정
 */
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { listConflicts, resolveConflict, type PendingConflict } from '@/lib/conflicts';
import { useThemedColors } from '@/lib/design-tokens';

export default function ConflictsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const [conflicts, setConflicts] = useState<PendingConflict[]>([]);

  const load = useCallback(async () => {
    setConflicts(await listConflicts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const keepMine = async (c: PendingConflict) => {
    try {
      const serverVersion = (c.server_state.version as number | undefined) ?? 1;
      await api.locations.update(
        c.trip_id,
        c.entity_id,
        c.my_change as Record<string, unknown>,
        { expectedVersion: serverVersion },
      );
      await resolveConflict(c.id);
      Toast.show({ type: 'success', text1: '내 변경을 반영했어요', position: 'bottom' });
      load();
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: unknown } } };
      if (err?.response?.status === 409) {
        Alert.alert('또 충돌이 발생했어요', '서버가 다시 변경되었어요. 잠시 후 다시 시도해주세요.');
        load();
      } else {
        Alert.alert('업데이트 실패', '잠시 후 다시 시도해주세요');
      }
    }
  };

  const acceptServer = async (c: PendingConflict) => {
    await resolveConflict(c.id);
    Toast.show({ type: 'success', text1: '서버 값을 받아들였어요', position: 'bottom' });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginLeft: 8 }}>
          ⚡ 동기화 충돌
        </Text>
      </View>

      {conflicts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 32 }}>✅</Text>
          <Text style={{ fontSize: 14, color: colors.txSecondary, marginTop: 8 }}>
            해결할 충돌이 없어요
          </Text>
        </View>
      ) : (
        <FlatList
          data={conflicts}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <ConflictCard
              conflict={item}
              colors={colors}
              onKeepMine={() => keepMine(item)}
              onAcceptServer={() => acceptServer(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function ConflictCard({
  conflict, colors, onKeepMine, onAcceptServer,
}: {
  conflict: PendingConflict;
  colors: ReturnType<typeof useThemedColors>;
  onKeepMine: () => void;
  onAcceptServer: () => void;
}) {
  // 변경된 필드만 추려서 비교 표시
  const changedKeys = Object.keys(conflict.my_change).filter(
    (k) => k !== 'id' && k !== 'trip_id' && k !== 'created_at',
  );

  return (
    <View
      style={{
        padding: 14, borderRadius: 14,
        backgroundColor: colors.bgSurface,
        borderWidth: 1, borderColor: colors.lineDefault,
        gap: 10,
      }}>
      <View>
        <Text style={{ fontSize: 13, color: colors.txTertiary }}>
          여행 #{conflict.trip_id} · 장소 #{conflict.entity_id}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.txPrimary, marginTop: 2 }}>
          {(conflict.server_state.name as string | undefined) ?? '장소 변경 충돌'}
        </Text>
      </View>

      {/* 비교 표 */}
      <View style={{ gap: 6 }}>
        {changedKeys.map((k) => {
          const mine = formatValue((conflict.my_change as Record<string, unknown>)[k]);
          const server = formatValue((conflict.server_state as Record<string, unknown>)[k]);
          if (mine === server) return null;
          return (
            <View key={k} style={{ gap: 2 }}>
              <Text style={{ fontSize: 11, color: colors.txTertiary }}>{k}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, padding: 6, borderRadius: 8, backgroundColor: colors.bgSubtle }}>
                  <Text style={{ fontSize: 10, color: colors.brandPrimary, fontWeight: '700' }}>내 변경</Text>
                  <Text style={{ fontSize: 12, color: colors.txPrimary }} numberOfLines={2}>{mine}</Text>
                </View>
                <View style={{ flex: 1, padding: 6, borderRadius: 8, backgroundColor: colors.bgSubtle }}>
                  <Text style={{ fontSize: 10, color: colors.brandSecondary, fontWeight: '700' }}>서버</Text>
                  <Text style={{ fontSize: 12, color: colors.txPrimary }} numberOfLines={2}>{server}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={onAcceptServer}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10,
            alignItems: 'center',
            backgroundColor: colors.bgBase,
            borderWidth: 1, borderColor: colors.lineDefault,
          }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.txSecondary }}>
            서버 값 받기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onKeepMine}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10,
            alignItems: 'center',
            backgroundColor: colors.brandPrimary,
          }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
            내 변경 유지
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v;
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}
