import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripCard } from '@/components/TripCard';
import { TripCardSkeleton } from '@/components/TripCardSkeleton';
import { BottomSheet, Button, EmptyState, TextField } from '@/components/ui';
import { palette, placeholderColor, shadow } from '@/lib/design-tokens';
import { useCreateTrip, useDeleteTrip, useTrips, useUpdateTrip } from '@/lib/queries';
import type { Trip } from '@/lib/types';

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

/** Date → 'YYYY-MM-DD' (UTC 변환 없이 로컬 기준) */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → 'YYYY. MM. DD' 표시용 */
function displayDate(s: string | null): string {
  if (!s) return '날짜 선택';
  const [y, m, d] = s.split('-');
  return `${y}. ${m}. ${d}`;
}

// ─── 날짜 선택 Row ─────────────────────────────────────────────────────────────

function DateRow({ label, value, onPress }: { label: string; value: string | null; onPress: () => void }) {
  const hasDate = Boolean(value);
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 mb-3"
      onPress={onPress}
      activeOpacity={0.8}>
      <Text className="text-sm text-tx-secondary">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Text className={`text-sm font-semibold ${hasDate ? 'text-tx-brand' : 'text-tx-tertiary'}`}>
          {displayDate(value)}
        </Text>
        <Text className="text-tx-tertiary text-xs">›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── 여행 생성/편집 바텀시트 ──────────────────────────────────────────────────

interface TripFormData {
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface TripFormSheetProps {
  visible: boolean;
  initial?: Partial<TripFormData>;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (data: TripFormData) => Promise<void>;
}

function TripFormSheet({ visible, initial = {}, mode, onClose, onSubmit }: TripFormSheetProps) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [startDate, setStartDate] = useState<string | null>(initial.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(initial.end_date ?? null);
  const [loading, setLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initial.title ?? '');
      setStartDate(initial.start_date ?? null);
      setEndDate(initial.end_date ?? null);
      setPickerTarget(null);
    }
  }, [visible]);

  function onPickerChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (!selected) return;
    const str = toDateStr(selected);
    if (pickerTarget === 'start') {
      setStartDate(str);
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

  const isEdit = mode === 'edit';
  const showPicker = pickerTarget !== null;
  const pickerValue = pickerTarget === 'start'
    ? (startDate ? new Date(startDate) : new Date())
    : (endDate ? new Date(endDate) : new Date());
  const pickerMinDate = pickerTarget === 'end' && startDate ? new Date(startDate) : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissible={!loading}
      title={isEdit ? '여행 정보 수정' : '새 여행 만들기'}
      subtitle={isEdit ? '수정할 내용을 입력해주세요' : '여행 정보를 입력해주세요'}>

      <TextField
        label="여행명"
        placeholder={isEdit ? '여행 이름' : '예: 도쿄 봄 여행 🌸'}
        value={title}
        onChangeText={setTitle}
        autoFocus={!isEdit}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        containerClassName="mb-4"
      />

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
            <Text className="text-tx-brand font-semibold text-sm">확인</Text>
          </TouchableOpacity>
        </View>
      )}

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          minimumDate={pickerMinDate}
          onChange={onPickerChange}
        />
      )}

      {(startDate || endDate) && (
        <TouchableOpacity
          className="items-center mb-3"
          onPress={() => { setStartDate(null); setEndDate(null); }}
          activeOpacity={0.7}>
          <Text className="text-xs text-tx-tertiary">날짜 초기화</Text>
        </TouchableOpacity>
      )}

      <Button
        label={isEdit ? '수정하기' : '만들기'}
        onPress={handleSubmit}
        loading={loading}
        disabled={title.trim().length === 0}
      />
    </BottomSheet>
  );
}

// ─── 검색바 ────────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="mx-4 my-3 flex-row items-center bg-bg-surface border border-line-default rounded-xl px-3 gap-2">
      <Text className="text-base text-tx-tertiary">🔍</Text>
      <TextInput
        className="flex-1 py-3 text-sm text-tx-primary"
        placeholder="여행 이름으로 검색"
        placeholderTextColor={placeholderColor}
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

  const tripsQuery = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);

  const trips = tripsQuery.data ?? [];
  // SQLite hydrate된 캐시가 있으면 isPending=false. 캐시 없을 때만 진짜 로딩.
  const showSkeleton = tripsQuery.isPending && trips.length === 0;
  const syncing = tripsQuery.isFetching;

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
          onPress: () => {
            deleteTrip.mutate(trip.id, {
              onError: () => Alert.alert('오류', '여행 삭제에 실패했습니다.'),
            });
          },
        },
      ],
    );
  }

  async function handleCreate(data: TripFormData) {
    try {
      await createTrip.mutateAsync(data);
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
      await updateTrip.mutateAsync({ id: editTarget.id, body: data });
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
          <View className="w-9 h-9 rounded-full bg-brand-primary items-center justify-center">
            <Text className="text-tx-inverse text-sm font-bold">T</Text>
          </View>
        </View>
      </View>

      {/* ── 검색바 ── */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* ── 여행 목록 ── */}
      {showSkeleton ? (
        <View className="pt-1">
          <TripCardSkeleton />
          <TripCardSkeleton />
          <TripCardSkeleton />
        </View>
      ) : (
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
          ListEmptyComponent={
            searchQuery ? (
              <EmptyState
                icon="🔍"
                title="검색 결과가 없어요"
                description={`"${searchQuery}"에 대한 여행을 찾을 수 없어요`}
              />
            ) : (
              <EmptyState
                icon="✈️"
                title="아직 여행이 없어요"
                description={'+ 버튼을 눌러\n첫 번째 여행을 시작해보세요'}
                ctaLabel="새 여행 만들기"
                onCtaPress={() => setShowCreate(true)}
              />
            )
          }
          ListHeaderComponent={<View className="h-1" />}
          ListFooterComponent={<View style={{ height: insets.bottom + 96 }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={syncing}
              onRefresh={() => tripsQuery.refetch()}
              tintColor={palette.coral500}
              title="업데이트 중..."
              titleColor={placeholderColor}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={8}
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        className="absolute right-5 w-14 h-14 rounded-full bg-brand-primary items-center justify-center"
        style={{ bottom: insets.bottom + 20, ...shadow.fab }}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}>
        <Text className="text-tx-inverse text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>

      {/* ── 새 여행 생성 시트 ── */}
      <TripFormSheet
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />

      {/* ── 여행 편집 시트 ── */}
      <TripFormSheet
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
