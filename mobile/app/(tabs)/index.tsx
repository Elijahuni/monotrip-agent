import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
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

/** Date 객체 → 'YYYY-MM-DD' 문자열 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** 'YYYY-MM-DD' 문자열 → 'YYYY. MM. DD' 표시용 */
function displayDate(s: string | null): string {
  if (!s) return '날짜 선택';
  const [y, m, d] = s.split('-');
  return `${y}. ${m}. ${d}`;
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

// ─── 날짜 선택 Row ─────────────────────────────────────────────────────────────

interface DateRowProps {
  label: string;
  value: string | null;
  onPress: () => void;
}

function DateRow({ label, value, onPress }: DateRowProps) {
  const hasDate = Boolean(value);
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 mb-3"
      onPress={onPress}
      activeOpacity={0.8}>
      <Text className="text-sm text-tx-secondary">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Text className={`text-sm font-semibold ${hasDate ? 'text-triple-blue' : 'text-tx-tertiary'}`}>
          {displayDate(value)}
        </Text>
        <Text className="text-tx-tertiary text-xs">›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── 여행 생성/편집 모달 (날짜 포함) ──────────────────────────────────────────

interface TripFormData {
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface TripFormModalProps {
  visible: boolean;
  initial?: Partial<TripFormData>;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (data: TripFormData) => Promise<void>;
}

function TripFormModal({ visible, initial = {}, mode, onClose, onSubmit }: TripFormModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initial.title ?? '');
  const [startDate, setStartDate] = useState<string | null>(initial.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(initial.end_date ?? null);
  const [loading, setLoading] = useState(false);

  // 어떤 picker가 열려 있는지 ('start' | 'end' | null)
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initial.title ?? '');
      setStartDate(initial.start_date ?? null);
      setEndDate(initial.end_date ?? null);
      setPickerTarget(null);
    }
  }, [visible]);

  function handleClose() {
    if (!loading) { setPickerTarget(null); onClose(); }
  }

  function onPickerChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerTarget(null); // Android는 선택 즉시 닫힘
    if (!selected) return;
    const str = toDateStr(selected);
    if (pickerTarget === 'start') {
      setStartDate(str);
      // 출발일이 귀국일보다 늦으면 귀국일 초기화
      if (endDate && str > endDate) setEndDate(null);
    } else {
      setEndDate(str);
    }
  }

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onSubmit({ title: trimmed, start_date: startDate, end_date: endDate });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = title.trim().length > 0 && !loading;
  const isEdit = mode === 'edit';

  // iOS: picker는 인라인(display="spinner"), Android: 별도 다이얼로그
  const showPicker = pickerTarget !== null;
  const pickerValue = pickerTarget === 'start'
    ? (startDate ? new Date(startDate) : new Date())
    : (endDate ? new Date(endDate) : new Date());
  const pickerMinDate = pickerTarget === 'end' && startDate ? new Date(startDate) : undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={handleClose}>
        <ScrollView
          onStartShouldSetResponder={() => true}
          keyboardShouldPersistTaps="handled"
          className="bg-bg-base rounded-t-3xl"
          style={{ maxHeight: '85%' }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}>
          {/* 핸들 */}
          <View className="w-10 h-1 bg-line-strong rounded-full self-center mb-5" />

          <Text className="text-lg font-bold text-tx-primary mb-1">
            {isEdit ? '여행 정보 수정' : '새 여행 만들기'}
          </Text>
          <Text className="text-sm text-tx-tertiary mb-4">
            {isEdit ? '수정할 내용을 입력해주세요' : '여행 정보를 입력해주세요'}
          </Text>

          {/* 여행명 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">여행명</Text>
          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-4"
            placeholder={isEdit ? '여행 이름' : '예: 도쿄 봄 여행 🌸'}
            placeholderTextColor="#9BA7B5"
            value={title}
            onChangeText={setTitle}
            autoFocus={!isEdit}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {/* 날짜 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">
            여행 기간 <Text className="text-tx-tertiary font-normal">(선택)</Text>
          </Text>
          <DateRow
            label="출발일"
            value={startDate}
            onPress={() => setPickerTarget(pickerTarget === 'start' ? null : 'start')}
          />
          <DateRow
            label="귀국일"
            value={endDate}
            onPress={() => setPickerTarget(pickerTarget === 'end' ? null : 'end')}
          />

          {/* iOS 인라인 날짜 Picker */}
          {showPicker && Platform.OS === 'ios' && (
            <View className="bg-bg-subtle rounded-xl mb-3 overflow-hidden">
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                minimumDate={pickerMinDate}
                onChange={onPickerChange}
                locale="ko-KR"
              />
              <TouchableOpacity
                className="items-center py-3 border-t border-line-default"
                onPress={() => setPickerTarget(null)}>
                <Text className="text-triple-blue font-semibold text-sm">확인</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Android는 날짜 선택 시 시스템 다이얼로그 자동 표시 */}
          {showPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="default"
              minimumDate={pickerMinDate}
              onChange={onPickerChange}
            />
          )}

          {/* 날짜 클리어 버튼 */}
          {(startDate || endDate) && (
            <TouchableOpacity
              className="items-center mb-3"
              onPress={() => { setStartDate(null); setEndDate(null); }}
              activeOpacity={0.7}>
              <Text className="text-xs text-tx-tertiary">날짜 초기화</Text>
            </TouchableOpacity>
          )}

          {/* 제출 버튼 */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${canSubmit ? 'bg-triple-blue' : 'bg-bg-subtle'}`}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${canSubmit ? 'text-tx-inverse' : 'text-tx-disabled'}`}>
                {isEdit ? '수정하기' : '만들기'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);

  const loadLocal = useCallback(async () => {
    setTrips(await getTrips());
  }, []);

  const syncRemote = useCallback(async () => {
    setSyncing(true);
    try {
      const remote = await api.trips.getAll();
      await syncTrips(remote);
      setTrips(remote);
    } catch { /* 오프라인 → 로컬 유지 */ }
    finally { setSyncing(false); }
  }, []);

  useEffect(() => {
    (async () => {
      await loadLocal();
      setLoading(false);
      syncRemote();
    })();
  }, []);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
    );
  }, [trips, searchQuery]);

  function handleLongPress(trip: Trip) {
    Alert.alert(trip.title, '이 여행에 대한 작업을 선택하세요', [
      { text: '✏️ 정보 수정', onPress: () => setEditTarget(trip) },
      { text: '🗑️ 삭제', style: 'destructive', onPress: () => confirmDelete(trip) },
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
            } catch { Alert.alert('오류', '여행 삭제에 실패했습니다.'); }
          },
        },
      ],
    );
  }

  async function handleCreate(data: TripFormData) {
    try {
      const trip = await api.trips.create(data);
      await saveTrip(trip as Trip);
      setTrips((prev) => [trip as Trip, ...prev]);
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '여행 생성에 실패했습니다.')
        : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
      throw e;
    }
  }

  async function handleEdit(data: TripFormData) {
    if (!editTarget) return;
    try {
      const updated = await api.trips.update(editTarget.id, data);
      await saveTrip(updated as Trip);
      setTrips((prev) => prev.map((t) => t.id === editTarget.id ? { ...t, ...data } : t));
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '수정에 실패했습니다.')
        : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
      throw e;
    } finally { setEditTarget(null); }
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
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={syncRemote}
            tintColor="#3DC3EE"
            title="업데이트 중..."
            titleColor="#9BA7B5"
          />
        }
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
        onSubmit={handleCreate}
      />

      {/* ── 여행 편집 모달 ── */}
      <TripFormModal
        visible={editTarget !== null}
        mode="edit"
        initial={editTarget ? {
          title: editTarget.title,
          start_date: editTarget.start_date,
          end_date: editTarget.end_date,
        } : {}}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </View>
  );
}
