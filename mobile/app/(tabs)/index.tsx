import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonalBanner } from '@/components/PersonalBanner';
import { QuickActionBar } from '@/components/QuickActionBar';
import { TrendingPostCard } from '@/components/TrendingPostCard';
import { TripCardSkeleton } from '@/components/TripCardSkeleton';
import { BottomSheet, Button, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, shadow, useThemedColors } from '@/lib/design-tokens';
import { handleApiError } from '@/lib/error-handler';
import { cancelTripNotifications, scheduleTripNotifications } from '@/lib/notifications';
import { useCreateTrip, useDeleteTrip, usePendingCount, useTrips, useUpdateTrip } from '@/lib/queries';
import { useSettings } from '@/lib/settings-context';
import { useIsFlushing } from '@/store';
import type { TrendingPost, Trip } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  destination?: string | null;
  start_date: string | null;
  end_date: string | null;
  group_size: number;
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
  const [destination, setDestination] = useState(initial.destination ?? '');
  const [startDate, setStartDate] = useState<string | null>(initial.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(initial.end_date ?? null);
  const [groupSize, setGroupSize] = useState(initial.group_size ?? 1);
  const [loading, setLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initial.title ?? '');
      setDestination(initial.destination ?? '');
      setStartDate(initial.start_date ?? null);
      setEndDate(initial.end_date ?? null);
      setGroupSize(initial.group_size ?? 1);
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
    if (startDate && endDate && startDate > endDate) {
      Alert.alert('날짜 오류', '출발일은 귀국일보다 이전이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ title: trimmed, destination: destination.trim() || null, start_date: startDate, end_date: endDate, group_size: groupSize });
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
        returnKeyType="next"
        containerClassName="mb-3"
      />

      <TextField
        label="목적지 (선택)"
        placeholder="예: 도쿄, 파리, 방콕"
        value={destination}
        onChangeText={setDestination}
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

      <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">인원</Text>
      <View className="flex-row items-center bg-bg-subtle rounded-xl px-4 py-2 mb-4">
        <TouchableOpacity
          onPress={() => setGroupSize(g => Math.max(1, g - 1))}
          activeOpacity={0.7}
          className="w-8 h-8 rounded-full bg-bg-base border border-line-default items-center justify-center">
          <Text className="text-lg text-tx-primary leading-none">−</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-base font-semibold text-tx-primary">{groupSize}명</Text>
        </View>
        <TouchableOpacity
          onPress={() => setGroupSize(g => Math.min(50, g + 1))}
          activeOpacity={0.7}
          className="w-8 h-8 rounded-full bg-bg-base border border-line-default items-center justify-center">
          <Text className="text-lg text-tx-primary leading-none">+</Text>
        </TouchableOpacity>
      </View>

      <Button
        label={isEdit ? '수정하기' : '만들기'}
        onPress={handleSubmit}
        loading={loading}
        disabled={title.trim().length === 0}
      />
    </BottomSheet>
  );
}

// ─── 홈 화면 (디스커버리) ─────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemedColors();
  const { t } = useSettings();

  const tripsQuery = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();

  const pendingCount = usePendingCount();
  const isFlushing = useIsFlushing();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);

  const allTrips: Trip[] = useMemo(
    () => tripsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [tripsQuery.data],
  );

  // 인기 여행기
  const trendingQuery = useQuery<TrendingPost[]>({
    queryKey: ['trending'],
    queryFn: () => api.community.trending({ limit: 10 }),
    staleTime: 5 * 60 * 1000,
  });

  const trendingPosts = trendingQuery.data ?? [];

  async function handleCreate(data: TripFormData) {
    try {
      const trip = await createTrip.mutateAsync(data);
      if (trip.start_date) {
        scheduleTripNotifications({ tripId: trip.id, tripTitle: trip.title, startDate: trip.start_date }).catch(() => {});
      }
    } catch (e) {
      handleApiError(e, '여행 생성에 실패했습니다.');
      throw e;
    }
  }

  async function handleEdit(data: TripFormData) {
    if (!editTarget) return;
    try {
      const trip = await updateTrip.mutateAsync({ id: editTarget.id, body: data });
      if (trip.start_date) {
        scheduleTripNotifications({ tripId: trip.id, tripTitle: trip.title, startDate: trip.start_date }).catch(() => {});
      } else {
        cancelTripNotifications(trip.id).catch(() => {});
      }
    } catch (e) {
      handleApiError(e, '수정에 실패했습니다.');
      throw e;
    } finally {
      setEditTarget(null);
    }
  }

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-4 pb-3 border-b border-line-default flex-row items-center justify-between">
        <Text className="text-xl font-bold text-tx-primary">triple</Text>
        <View className="flex-row items-center gap-3">
          {(isFlushing || pendingCount > 0) && (
            <ActivityIndicator size="small" color={palette.coral500} />
          )}
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-brand-primary items-center justify-center"
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.8}
          >
            <Text className="text-tx-inverse text-sm font-bold">T</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── 퀵액션 바 ── */}
        <QuickActionBar />

        {/* ── 개인화 배너 ── */}
        <PersonalBanner />

        {/* ── 내 여행 링크 — 여행 목록으로 이동 ── */}
        {allTrips.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
            {allTrips.slice(0, 3).map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgBase,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: colors.lineDefault,
                }}
                onPress={() => router.push(`/trips/${trip.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>✈️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.txPrimary }} numberOfLines={1}>
                    {trip.title}
                  </Text>
                  {trip.destination && (
                    <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>
                      {trip.destination}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: colors.txTertiary }}>›</Text>
              </TouchableOpacity>
            ))}
            {allTrips.length > 3 && (
              <Text style={{ fontSize: 12, color: colors.txTertiary, textAlign: 'center', marginTop: 4 }}>
                +{allTrips.length - 3}개 더
              </Text>
            )}
          </View>
        )}

        {/* ── 인기 여행기 섹션 ── */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
              {t('home', 'trending')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/community' as any)} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, color: colors.brandPrimary, fontWeight: '600' }}>
                {t('home', 'trendingMore')}
              </Text>
            </TouchableOpacity>
          </View>

          {trendingQuery.isLoading ? (
            <>
              <TripCardSkeleton />
              <TripCardSkeleton />
            </>
          ) : trendingPosts.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>✈️</Text>
              <Text style={{ fontSize: 14, color: colors.txTertiary }}>
                {t('home', 'trendingEmpty')}
              </Text>
            </View>
          ) : (
            trendingPosts.map((post) => (
              <TrendingPostCard
                key={post.id}
                post={post}
                onPress={() => router.push('/community' as any)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ── FAB — 새 여행 만들기 ── */}
      <TouchableOpacity
        className="absolute right-5 w-14 h-14 rounded-full bg-brand-primary items-center justify-center"
        style={{ bottom: insets.bottom + 20, ...shadow.fab }}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Text className="text-tx-inverse text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>

      {/* ── 여행 생성 시트 ── */}
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
          destination: editTarget.destination,
          start_date: editTarget.start_date,
          end_date: editTarget.end_date,
          group_size: editTarget.group_size,
        } : {}}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </View>
  );
}
