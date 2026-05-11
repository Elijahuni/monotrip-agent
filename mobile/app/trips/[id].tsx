import { AxiosError } from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { deleteTrip, saveTrip } from '@/lib/local-trips';
import type { Location, Trip } from '@/lib/types';

// ─── 카테고리 ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['숙소', '음식점', '관광지', '카페', '쇼핑', '자연', '문화', '엔터테인먼트'];

const CATEGORY_ICONS: Record<string, string> = {
  숙소: '🏨', 음식점: '🍜', 관광지: '🗺️',
  카페: '☕', 쇼핑: '🛍️', 자연: '🌿',
  문화: '🏛️', 엔터테인먼트: '🎭',
};

function categoryIcon(cat: string) { return CATEGORY_ICONS[cat] ?? '📍'; }

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  return '날짜 미정';
}

// ─── 장소 카드 ─────────────────────────────────────────────────────────────────

function LocationCard({ loc, index, onDelete }: {
  loc: Location;
  index: number;
  onDelete: (id: number) => void;
}) {
  return (
    <View
      className={`flex-row items-start gap-3 py-4 ${index > 0 ? 'border-t border-line-default' : ''}`}>
      <View className="w-8 h-8 rounded-full bg-triple-blue items-center justify-center mt-0.5 shrink-0">
        <Text className="text-tx-inverse text-xs font-bold">{loc.visit_order || index + 1}</Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-1.5 mb-0.5">
          <Text className="text-sm">{categoryIcon(loc.category)}</Text>
          <Text className="text-xs text-tx-tertiary">{loc.category}</Text>
        </View>
        <Text className="text-sm font-bold text-tx-primary">{loc.name}</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5" numberOfLines={1}>
          📍 {loc.address}
        </Text>
        {loc.notes ? (
          <Text className="text-xs text-tx-secondary mt-1 leading-relaxed" numberOfLines={2}>
            {loc.notes}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        className="p-1.5 mt-0.5"
        onPress={() => {
          Alert.alert('장소 삭제', `"${loc.name}"을 삭제하시겠어요?`, [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => onDelete(loc.id) },
          ]);
        }}
        activeOpacity={0.7}>
        <Text className="text-tx-tertiary text-base">✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── 장소 추가 모달 ────────────────────────────────────────────────────────────

interface AddLocationModalProps {
  visible: boolean;
  tripId: number;
  nextOrder: number;
  onClose: () => void;
  onAdded: (loc: Location) => void;
}

function AddLocationModal({ visible, tripId, nextOrder, onClose, onAdded }: AddLocationModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState(CATEGORIES[2]); // 기본: 관광지
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function handleClose() {
    if (!loading) { setName(''); setAddress(''); setNotes(''); onClose(); }
  }

  async function handleAdd() {
    if (!name.trim() || !address.trim()) return;
    setLoading(true);
    try {
      const loc = await api.locations.create(tripId, {
        name: name.trim(),
        address: address.trim(),
        latitude: 0,
        longitude: 0,
        category,
        visit_order: nextOrder,
        notes: notes.trim() || null,
      });
      onAdded(loc as Location);
      setName(''); setAddress(''); setNotes('');
      onClose();
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '장소 추가에 실패했습니다.')
        : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  }

  const canAdd = name.trim().length > 0 && address.trim().length > 0 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity className="flex-1 bg-black/40 justify-end" activeOpacity={1} onPress={handleClose}>
        <ScrollView
          onStartShouldSetResponder={() => true}
          keyboardShouldPersistTaps="handled"
          className="bg-bg-base rounded-t-3xl"
          style={{ maxHeight: '85%' }}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16, paddingHorizontal: 24, paddingTop: 20 }}>

          {/* 핸들 */}
          <View className="w-10 h-1 bg-line-strong rounded-full self-center mb-5" />
          <Text className="text-lg font-bold text-tx-primary mb-1">장소 추가</Text>
          <Text className="text-sm text-tx-tertiary mb-4">여행에 방문할 장소를 추가해보세요</Text>

          {/* 장소명 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">장소명</Text>
          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-3"
            placeholder="예: 도쿄 타워"
            placeholderTextColor="#9BA7B5"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* 주소 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">주소</Text>
          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-3"
            placeholder="예: 일본 도쿄 미나토구"
            placeholderTextColor="#9BA7B5"
            value={address}
            onChangeText={setAddress}
          />

          {/* 카테고리 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                className={`mx-1 px-3 py-2 rounded-full flex-row items-center gap-1 ${category === cat ? 'bg-triple-blue' : 'bg-bg-subtle'}`}
                onPress={() => setCategory(cat)}
                activeOpacity={0.8}>
                <Text className="text-sm">{categoryIcon(cat)}</Text>
                <Text className={`text-xs font-semibold ${category === cat ? 'text-tx-inverse' : 'text-tx-secondary'}`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 메모 */}
          <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">
            메모 <Text className="text-tx-tertiary font-normal">(선택)</Text>
          </Text>
          <TextInput
            className="bg-bg-surface border border-line-default rounded-xl px-4 py-3.5 text-base text-tx-primary mb-4"
            placeholder="예: 야경이 아름다운 곳"
            placeholderTextColor="#9BA7B5"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            returnKeyType="done"
          />

          {/* 추가 버튼 */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${canAdd ? 'bg-triple-blue' : 'bg-bg-subtle'}`}
            onPress={handleAdd}
            disabled={!canAdd}
            activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-base ${canAdd ? 'text-tx-inverse' : 'text-tx-disabled'}`}>
                추가하기
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── 여행 상세 화면 ────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);

  const loadRemote = useCallback(async () => {
    try {
      const data = await api.trips.getOne(tripId);
      setTrip(data as Trip);
      setLocations((data.locations ?? []) as Location[]);
      await saveTrip(data as Trip);
    } catch {
      // 오프라인이면 로컬 데이터 유지
    }
  }, [tripId]);

  useEffect(() => {
    async function init() {
      // 원격에서 최신 데이터 로드 (로컬 DB에 단건 캐시 미구현으로 원격 우선)
      await loadRemote();
      setLoading(false);
    }
    init();
  }, [tripId]);

  async function handleDelete() {
    Alert.alert('여행 삭제', `"${trip?.title}" 여행을 삭제하시겠어요?\n장소 정보도 모두 사라집니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.trips.remove(tripId);
            await deleteTrip(tripId);
            router.back();
          } catch {
            Alert.alert('오류', '여행 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  }

  async function handleDeleteLocation(locationId: number) {
    try {
      await api.locations.remove(tripId, locationId);
      setLocations((prev) => prev.filter((l) => l.id !== locationId));
    } catch {
      Alert.alert('오류', '장소 삭제에 실패했습니다.');
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-bg-surface items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#3DC3EE" />
        <Text className="text-tx-tertiary text-sm mt-3">여행 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View className="flex-1 bg-bg-surface items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-tx-tertiary text-base">여행을 찾을 수 없습니다.</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-triple-blue font-semibold">← 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-3 pb-4 border-b border-line-default">
        <TouchableOpacity onPress={() => router.back()} className="mb-2 self-start" activeOpacity={0.7}>
          <Text className="text-triple-blue text-sm font-semibold">← 내 여행</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-tx-primary" numberOfLines={1}>{trip.title}</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5">
          {formatDateRange(trip.start_date, trip.end_date)}
        </Text>
        {trip.description ? (
          <Text className="text-sm text-tx-secondary mt-1.5 leading-relaxed" numberOfLines={2}>
            {trip.description}
          </Text>
        ) : null}
      </View>

      {/* ── 장소 섹션 헤더 ── */}
      <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
        <View>
          <Text className="text-base font-bold text-tx-primary">방문 장소</Text>
          <Text className="text-xs text-tx-tertiary mt-0.5">총 {locations.length}곳</Text>
        </View>
      </View>

      {/* ── 장소 목록 ── */}
      <FlatList
        data={locations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <LocationCard loc={item} index={index} onDelete={handleDeleteLocation} />
        )}
        ListHeaderComponent={<View />}
        ListEmptyComponent={
          <View className="items-center py-12 gap-2">
            <Text className="text-4xl">📍</Text>
            <Text className="text-base font-semibold text-tx-primary mt-2">장소가 없어요</Text>
            <Text className="text-sm text-tx-tertiary text-center px-8">
              + 버튼을 눌러 방문할 장소를 추가해보세요
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingBottom: insets.bottom + 96 }}>
            {/* ── 여행 삭제 버튼 ── */}
            <View className="mx-4 mt-6">
              <TouchableOpacity
                className="py-3.5 bg-bg-base rounded-xl items-center border border-line-default"
                onPress={handleDelete}
                activeOpacity={0.85}>
                <Text className="text-negative font-semibold text-sm">이 여행 삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB: 장소 추가 ── */}
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
        onPress={() => setShowAddLocation(true)}
        activeOpacity={0.85}>
        <Text className="text-tx-inverse text-3xl font-light leading-none mb-0.5">+</Text>
      </TouchableOpacity>

      {/* ── 장소 추가 모달 ── */}
      <AddLocationModal
        visible={showAddLocation}
        tripId={tripId}
        nextOrder={locations.length + 1}
        onClose={() => setShowAddLocation(false)}
        onAdded={(loc) => setLocations((prev) => [...prev, loc])}
      />
    </View>
  );
}
