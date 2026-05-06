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
      className="bg-white mx-4 mb-3 rounded-2xl p-4 shadow-sm border border-gray-100"
      onPress={onPress}
      activeOpacity={0.8}>
      <View className="flex-row items-center">
        <View className="w-1 self-stretch bg-blue-400 rounded-full mr-3" />
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
            {trip.title}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {formatDateRange(trip.start_date, trip.end_date)}
          </Text>
          {trip.description ? (
            <Text className="text-sm text-gray-500 mt-1.5" numberOfLines={2}>
              {trip.description}
            </Text>
          ) : null}
        </View>
        <Text className="text-gray-300 text-2xl ml-2">›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── 빈 상태 ───────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center gap-3 pb-20">
      <Text className="text-6xl">✈️</Text>
      <Text className="text-lg font-semibold text-gray-700 mt-2">아직 여행이 없어요</Text>
      <Text className="text-sm text-gray-400 text-center px-8">
        + 버튼을 눌러 첫 여행을 시작해보세요
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
    if (!loading) {
      setTitle('');
      onClose();
    }
  }

  const canSubmit = title.trim().length > 0 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* 백드롭: 탭하면 닫힘 */}
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={handleClose}>
        {/* 시트 영역: onStartShouldSetResponder로 터치 전파 차단 */}
        <View
          onStartShouldSetResponder={() => true}
          className="bg-white rounded-t-3xl px-6 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
          {/* 드래그 핸들 */}
          <View className="w-10 h-1 bg-gray-200 rounded-full self-center mb-5" />

          <Text className="text-lg font-bold text-gray-900 mb-4">새 여행 만들기</Text>

          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900 mb-4"
            placeholder="여행 제목 (예: 도쿄 봄 여행)"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${canSubmit ? 'bg-blue-500' : 'bg-gray-100'}`}
            onPress={handleCreate}
            disabled={!canSubmit}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${canSubmit ? 'text-white' : 'text-gray-400'}`}>
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
  const [loading, setLoading] = useState(true);   // SQLite 초기 로드 완료 전
  const [syncing, setSyncing] = useState(false);  // 백엔드 API 동기화 중
  const [showCreate, setShowCreate] = useState(false);

  // 1단계: 로컬 DB에서 먼저 읽기
  const loadLocal = useCallback(async () => {
    const local = await getTrips();
    setTrips(local);
  }, []);

  // 2단계: 백엔드와 동기화 (오프라인이면 조용히 실패)
  const syncRemote = useCallback(async () => {
    setSyncing(true);
    try {
      const remote = await api.trips.getAll();
      await syncTrips(remote);
      setTrips(remote);
    } catch {
      // 오프라인이거나 인증 만료 → 로컬 데이터 유지
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadLocal();
      setLoading(false); // 이 시점부터 EmptyState 표시 가능
      syncRemote();      // 백그라운드 동기화 (await 없이)
    }
    init();
  }, []);

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">내 여행</Text>
        {syncing && <ActivityIndicator size="small" color="#60a5fa" />}
      </View>

      {/* 여행 목록 */}
      <FlatList
        data={trips}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => router.push(`/trips/${item.id}` as never)}
          />
        )}
        // SQLite 로드 전에는 EmptyState 숨김 (깜빡임 방지)
        ListEmptyComponent={loading ? null : <EmptyState />}
        ListHeaderComponent={<View className="h-4" />}
        ListFooterComponent={<View style={{ height: insets.bottom + 96 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute right-6 w-14 h-14 rounded-full bg-blue-500 items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 24 }}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}>
        <Text className="text-white text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>

      {/* 새 여행 생성 모달 */}
      <CreateTripModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(trip) => setTrips((prev) => [trip, ...prev])}
      />
    </View>
  );
}
