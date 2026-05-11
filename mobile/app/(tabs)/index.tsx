import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { deleteTrip, getTrips, saveTrip, syncTrips } from '@/lib/local-trips';
import type { Trip } from '@/lib/types';

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  return '날짜 미정';
}

// ─── 여행 카드 ─────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
  onLongPress: () => void;
}

const TripCard = ({ trip, onPress, onLongPress }: TripCardProps) => (
  <TouchableOpacity
    className="bg-bg-base mx-4 mb-3 rounded-2xl overflow-hidden"
    style={{
      shadowColor: '#1A2E44',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={400}
    activeOpacity={0.8}>
    {/* 상단 블루 배너 */}
    <View className="h-1.5 bg-triple-blue" />
    <View className="px-4 py-4">
      <Text className="text-base font-bold text-tx-primary" numberOfLines={1}>
        {trip.title}
      </Text>
      <View className="flex-row items-center mt-1.5 gap-1">
        <Text className="text-xs text-tx-tertiary">📅</Text>
        <Text className="text-xs text-tx-tertiary">
          {formatDateRange(trip.start_date, trip.end_date)}
        </Text>
      </View>
      {trip.description ? (
        <Text className="text-sm text-tx-secondary mt-2 leading-relaxed" numberOfLines={2}>
          {trip.description}
        </Text>
      ) : null}
      <View className="flex-row justify-end mt-3">
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-triple-blue font-semibold">자세히 보기</Text>
          <Text className="text-triple-blue text-xs">›</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

// ─── 빈 상태 ───────────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <View className="flex-1 items-center justify-center gap-2 pb-24">
        <Text className="text-4xl">🔍</Text>
        <Text className="text-base font-bold text-tx-primary mt-2">검색 결과가 없어요</Text>
        <Text className="text-sm text-tx-tertiary text-center px-8">
          "{query}"에 대한 여행을 찾을 수 없어요
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-3 pb-24">
      <View className="w-24 h-24 rounded-full bg-bg-subtle items-center justify-center mb-2">
        <Text className="text-5xl">✈️</Text>
      </View>
      <Text className="text-lg font-bold text-tx-primary">아직 여행이 없어요</Text>
      <Text className="text-sm text-tx-tertiary text-center px-8 leading-relaxed">
        + 버튼을 눌러{'\n'}첫 번째 여행을 시작해보세요
      </Text>
    </View>
  );
}

// ─── 여행 생성/편집 모달 ────────────────────────────────────────────────────────

interface TripFormModalProps {
  visible: boolean;
  initialTitle?: string;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

function TripFormModal({ visible, initialTitle = '', mode, onClose, onSubmit }: TripFormModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);

  // 모달 열릴 때 초기값 동기화
  useEffect(() => {
    if (visible) setTitle(initialTitle);
  }, [visible, initialTitle]);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) onClose();
  }

  const canSubmit = title.trim().length > 0 && !loading;
  const isEdit = mode === 'edit';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={handleClose}>
        <View
          onStartShouldSetResponder={() => true}
          className="bg-bg-base rounded-t-3xl px-6 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
          {/* 핸들 */}
          <View className="w-10 h-1 bg-line-strong rounded-full self-center mb-5" />

          <Text className="text-lg font-bold text-tx-primary mb-1">
            {isEdit ? '여행 이름 변경' : '새 여행 만들기'}
          </Text>
          <Text className="text-sm text-tx-tertiary mb-4">
            {isEdit ? '새로운 여행 이름을 입력해주세요' : '여행 제목을 입력해주세요'}
          </Text>

          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-4"
            placeholder={isEdit ? '여행 이름' : '예: 도쿄 봄 여행 🌸'}
            placeholderTextColor="#9BA7B5"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${canSubmit ? 'bg-triple-blue' : 'bg-bg-subtle'}`}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${canSubmit ? 'text-tx-inverse' : 'text-tx-disabled'}`}>
                {isEdit ? '변경하기' : '만들기'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── 검색바 ────────────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <View className="mx-4 my-3 flex-row items-center bg-bg-surface border border-line-default rounded-xl px-3 gap-2">
      <Text className="text-base text-tx-tertiary">🔍</Text>
      <TextInput
        className="flex-1 py-3 text-sm text-tx-primary"
        placeholder="여행 이름으로 검색"
        placeholderTextColor="#9BA7B5"
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} activeOpacity={0.7} className="p-1">
          <View className="w-4 h-4 rounded-full bg-tx-tertiary items-center justify-center">
            <Text className="text-tx-inverse text-xs leading-none">✕</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── 홈 화면 ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 모달 상태
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);

  // ── 로컬 DB 로드 ────────────────────────────────────────────────────────────
  const loadLocal = useCallback(async () => {
    const local = await getTrips();
    setTrips(local);
  }, []);

  // ── 원격 동기화 ─────────────────────────────────────────────────────────────
  const syncRemote = useCallback(async () => {
    setSyncing(true);
    try {
      const remote = await api.trips.getAll();
      await syncTrips(remote);
      setTrips(remote);
    } catch {
      // 오프라인 or 인증 만료 → 로컬 유지
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadLocal();
      setLoading(false);
      syncRemote();
    })();
  }, []);

  // ── 검색 필터 (메모이제이션) ─────────────────────────────────────────────────
  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    );
  }, [trips, searchQuery]);

  // ── 롱프레스 액션 ────────────────────────────────────────────────────────────
  function handleLongPress(trip: Trip) {
    Alert.alert(trip.title, '이 여행에 대한 작업을 선택하세요', [
      {
        text: '✏️ 이름 변경',
        onPress: () => setEditTarget(trip),
      },
      {
        text: '🗑️ 삭제',
        style: 'destructive',
        onPress: () => confirmDelete(trip),
      },
      { text: '취소', style: 'cancel' },
    ]);
  }

  function confirmDelete(trip: Trip) {
    Alert.alert(
      '여행 삭제',
      `"${trip.title}" 여행을 삭제하시겠어요?\n장소 정보도 모두 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.trips.remove(trip.id);
              await deleteTrip(trip.id);
              setTrips((prev) => prev.filter((t) => t.id !== trip.id));
            } catch {
              Alert.alert('오류', '여행 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  }

  // ── 여행 편집 제출 ───────────────────────────────────────────────────────────
  async function handleEdit(newTitle: string) {
    if (!editTarget) return;
    try {
      const updated = await api.trips.update(editTarget.id, { title: newTitle });
      await saveTrip(updated as Trip);
      setTrips((prev) =>
        prev.map((t) => (t.id === editTarget.id ? { ...t, title: newTitle } : t)),
      );
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? '수정에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
      throw e; // 모달이 닫히지 않도록
    } finally {
      setEditTarget(null);
    }
  }

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-4 pb-4 border-b border-line-default flex-row items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-tx-primary">내 여행</Text>
          <Text className="text-xs text-tx-tertiary mt-0.5">나만의 여행을 계획해보세요</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {syncing && <ActivityIndicator size="small" color="#3DC3EE" />}
          <View className="w-8 h-8 rounded-full bg-triple-blue items-center justify-center">
            <Text className="text-tx-inverse text-sm font-bold">T</Text>
          </View>
        </View>
      </View>

      {/* ── 검색바 ── */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* ── 여행 목록 ── */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trips/${item.id}` as never)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        ListEmptyComponent={loading ? null : <EmptyState query={searchQuery} />}
        ListHeaderComponent={<View className="h-1" />}
        ListFooterComponent={<View style={{ height: insets.bottom + 96 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        // ── Pull to Refresh ──
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={syncRemote}
            tintColor="#3DC3EE"
            title="업데이트 중..."
            titleColor="#9BA7B5"
          />
        }
        // ── FlatList 성능 최적화 ──
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
      />

      {/* ── FAB ── */}
      <TouchableOpacity
        className="absolute right-5 w-14 h-14 rounded-full bg-triple-blue items-center justify-center"
        style={{
          bottom: insets.bottom + 20,
          shadowColor: '#3DC3EE',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 6,
        }}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}>
        <Text className="text-tx-inverse text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>

      {/* ── 새 여행 생성 모달 ── */}
      <TripFormModal
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={async (title) => {
          const trip = await api.trips.create({ title });
          await saveTrip(trip as Trip);
          setTrips((prev) => [trip as Trip, ...prev]);
        }}
      />

      {/* ── 여행 편집 모달 ── */}
      <TripFormModal
        visible={editTarget !== null}
        mode="edit"
        initialTitle={editTarget?.title ?? ''}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </View>
  );
}
