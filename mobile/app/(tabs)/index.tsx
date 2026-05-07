import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { getTrips, saveTrip, syncTrips } from '@/lib/local-trips';
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
}

function TripCard({ trip, onPress }: TripCardProps) {
  return (
    <TouchableOpacity
      className="bg-bg-base mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{ shadowColor: '#1A2E44', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
      onPress={onPress}
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
        {/* 하단 화살표 */}
        <View className="flex-row justify-end mt-3">
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-triple-blue font-semibold">자세히 보기</Text>
            <Text className="text-triple-blue text-xs">›</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── 빈 상태 ───────────────────────────────────────────────────────────────────

function EmptyState() {
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

// ─── 새 여행 생성 모달 ─────────────────────────────────────────────────────────

interface CreateTripModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (trip: Trip) => void;
}

function CreateTripModal({ visible, onClose, onCreated }: CreateTripModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const trip = await api.trips.create({ title: trimmed });
      await saveTrip(trip as Trip);
      onCreated(trip as Trip);
      setTitle('');
      onClose();
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? '여행 생성에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) { setTitle(''); onClose(); }
  }

  const canSubmit = title.trim().length > 0 && !loading;

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

          <Text className="text-lg font-bold text-tx-primary mb-1">새 여행 만들기</Text>
          <Text className="text-sm text-tx-tertiary mb-4">여행 제목을 입력해주세요</Text>

          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-4"
            placeholder="예: 도쿄 봄 여행 🌸"
            placeholderTextColor="#9BA7B5"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${canSubmit ? 'bg-triple-blue' : 'bg-bg-subtle'}`}
            onPress={handleCreate}
            disabled={!canSubmit}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${canSubmit ? 'text-tx-inverse' : 'text-tx-disabled'}`}>
                만들기
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── 홈 화면 ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadLocal = useCallback(async () => {
    const local = await getTrips();
    setTrips(local);
  }, []);

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
    async function init() {
      await loadLocal();
      setLoading(false);
      syncRemote();
    }
    init();
  }, []);

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

      {/* ── 여행 목록 ── */}
      <FlatList
        data={trips}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trips/${item.id}` as never)}
          />
        )}
        ListEmptyComponent={loading ? null : <EmptyState />}
        ListHeaderComponent={<View className="h-4" />}
        ListFooterComponent={<View style={{ height: insets.bottom + 96 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
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

      {/* ── 새 여행 모달 ── */}
      <CreateTripModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(trip) => setTrips((prev) => [trip, ...prev])}
      />
    </View>
  );
}
