import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { ItineraryShareCard, type ItineraryShareCardRef } from '@/components/ItineraryShareCard';
import { WeatherWidget } from '@/components/WeatherWidget';
import { AddLocationModal, type LocForm } from '@/components/trips/AddLocationModal';
import { BudgetCard } from '@/components/trips/BudgetCard';
import { ChecklistSection } from '@/components/trips/ChecklistSection';
import { DaySectionHeader } from '@/components/trips/DaySectionHeader';
import { RichLocationCard } from '@/components/trips/RichLocationCard';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { openFlightSearch } from '@/lib/flight-links';
import { queryKeys } from '@/lib/queries/client';
import { useDeleteLocation, useDeleteTrip, useTrip } from '@/lib/queries';
import { connectTripRealtime, type PresenceUser, type TripRealtimeHandle } from '@/lib/realtime';
import { PresenceStack } from '@/components/PresenceStack';
import { useSettings } from '@/lib/settings-context';
import { categoryEmoji, formatDate, groupByDay } from '@/lib/trip-utils';
import type { Location, Trip } from '@/lib/types';
import { useAuthStore } from '@/store';
import { shareInviteToKakao } from '@/app/trips/invite/[token]';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, lang } = useSettings();
  const qc = useQueryClient();

  const tripQuery = useTrip(tripId);
  const deleteTripMut = useDeleteTrip();
  const deleteLocationMut = useDeleteLocation();

  const trip = (tripQuery.data ?? null) as Trip | null;
  const locations = (tripQuery.data?.locations ?? []) as Location[];
  const loading = tripQuery.isPending;

  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [defaultDay, setDefaultDay] = useState(1);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const shareCardRef = useRef<ItineraryShareCardRef>(null);
  const realtimeRef = useRef<TripRealtimeHandle | null>(null);
  const [activeCollaborators, setActiveCollaborators] = useState<number[]>([]);
  const [activePresence, setActivePresence] = useState<PresenceUser[]>([]);
  // 다른 사용자가 방금 변경한 location id — 카드 하이라이트용. 3초 후 자동 클리어.
  const [recentlyChangedLocId, setRecentlyChangedLocId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myUserId = useAuthStore((s) => s.user?.user_id ?? null);
  const myUserIdRef = useRef<number | null>(myUserId);
  myUserIdRef.current = myUserId;

  // 실시간 협업 WebSocket — 화면 진입 시 연결, 이탈 시 정리.
  // 권한 없으면(404/403) 백엔드가 즉시 close하므로 안전.
  useEffect(() => {
    let cancelled = false;
    let handle: TripRealtimeHandle | null = null;
    (async () => {
      try {
        handle = await connectTripRealtime(tripId, {
          onPresenceChange: (users, rich) => {
            if (cancelled) return;
            setActiveCollaborators(users);
            if (rich) setActivePresence(rich);
          },
          onMessage: (msg) => {
            if (msg.type !== 'location_update') return;
            // 본인이 보낸 변경(백엔드 echo)이면 무시 — 이미 로컬 캐시에 반영됨
            const from = (msg as { from_user_id?: number }).from_user_id;
            if (from != null && myUserIdRef.current != null && from === myUserIdRef.current) return;

            qc.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });

            const op = (msg as { op?: string }).op;
            const locId = (msg as { location_id?: number }).location_id;
            const label =
              op === 'create' ? '동료가 장소를 추가했어요'
              : op === 'patch'  ? '동료가 장소를 수정했어요'
              : op === 'delete' ? '동료가 장소를 삭제했어요'
              : '동료가 일정을 변경했어요';
            Toast.show({ type: 'info', text1: label, position: 'bottom', visibilityTime: 2200 });

            if (typeof locId === 'number' && op !== 'delete') {
              setRecentlyChangedLocId(locId);
              if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
              highlightTimerRef.current = setTimeout(() => setRecentlyChangedLocId(null), 3000);
            }
          },
        });
        if (cancelled) handle.close();
        else realtimeRef.current = handle;
      } catch { /* 토큰 없음 등 — 무시 */ }
    })();
    return () => {
      cancelled = true;
      realtimeRef.current?.close();
      realtimeRef.current = null;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [tripId, qc]);

  const colors = useThemedColors();

  function totalDays() {
    if (trip?.start_date && trip?.end_date) {
      const diff = Math.ceil(
        (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000,
      ) + 1;
      return Math.max(diff, 1);
    }
    return Math.max(locations.reduce((m, l) => Math.max(m, l.day_index ?? 1), 1), 1);
  }

  async function handleAddLocation(form: LocForm) {
    const dayLocs = locations.filter((l) => (l.day_index ?? 1) === form.day_index);
    const newLoc = await api.locations.create(tripId, {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: form.latitude || 0,
      longitude: form.longitude || 0,
      category: form.category,
      visit_order: dayLocs.length + 1,
      notes: form.notes.trim() || null,
      ...(form.estimated_minutes ? { estimated_minutes: Number(form.estimated_minutes) } : {}),
      ...(form.budget_per_person ? { budget_per_person: Number(form.budget_per_person) } : {}),
      ...(form.images.length > 0 ? { images: form.images } : {}),
      day_index: form.day_index,
    } as Parameters<typeof api.locations.create>[1]);
    qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
      prev ? { ...prev, locations: [...(prev.locations ?? []), newLoc] } : prev,
    );
  }

  async function handleUpdateLocation(form: LocForm) {
    if (!editingLoc) return;
    const updated = await api.locations.update(tripId, editingLoc.id, {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: form.latitude || editingLoc.latitude,
      longitude: form.longitude || editingLoc.longitude,
      category: form.category,
      day_index: form.day_index,
      notes: form.notes.trim() || null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      budget_per_person: form.budget_per_person ? Number(form.budget_per_person) : null,
      images: form.images.length > 0 ? form.images : null,
    } as Partial<Location>);
    qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
      prev
        ? { ...prev, locations: (prev.locations ?? []).map((l: Location) => l.id === updated.id ? updated : l) }
        : prev,
    );
    setEditingLoc(null);
  }

  function handleDeleteLocation(loc: Location) {
    Alert.alert(
      lang === 'ko' ? '장소 삭제' : 'Delete Place',
      `"${loc.name}"`,
      [
        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ko' ? '삭제' : 'Delete', style: 'destructive',
          onPress: () => deleteLocationMut.mutate(
            { tripId, locationId: loc.id },
            { onError: () => Alert.alert(lang === 'ko' ? '오류' : 'Error', lang === 'ko' ? '장소 삭제 실패' : 'Failed to delete') },
          ),
        },
      ],
    );
  }

  async function handleMoveLocation(loc: Location, direction: 'up' | 'down') {
    const dayLocs = locations
      .filter((l) => (l.day_index ?? 1) === (loc.day_index ?? 1))
      .sort((a, b) => a.visit_order - b.visit_order);
    const idx = dayLocs.findIndex((l) => l.id === loc.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= dayLocs.length) return;
    const target = dayLocs[swapIdx];
    try {
      const [updA, updB] = await Promise.all([
        api.locations.update(tripId, loc.id, { visit_order: target.visit_order } as Partial<Location>),
        api.locations.update(tripId, target.id, { visit_order: loc.visit_order } as Partial<Location>),
      ]);
      qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
        prev
          ? {
            ...prev,
            locations: (prev.locations ?? []).map((l: Location) => {
              if (l.id === updA.id) return updA;
              if (l.id === updB.id) return updB;
              return l;
            }),
          }
          : prev,
      );
    } catch { /* offline — ignore */ }
  }

  function handleDeleteTrip() {
    Alert.alert(
      lang === 'ko' ? '여행 삭제' : 'Delete Trip',
      lang === 'ko' ? '모든 장소도 함께 삭제됩니다.' : 'All places will be deleted.',
      [
        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ko' ? '삭제' : 'Delete', style: 'destructive',
          onPress: () => deleteTripMut.mutate(tripId, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  async function handleImageShare() {
    await shareCardRef.current?.shareAsImage();
  }

  async function handleShare() {
    try {
      const { share_url } = await api.trips_share.create(tripId);
      await Share.share({
        message: lang === 'ko'
          ? `여행 일정 공유 🗺️\n${share_url}`
          : `Check out my trip 🗺️\n${share_url}`,
      });
    } catch { Alert.alert(lang === 'ko' ? '공유 실패' : 'Share failed'); }
  }

  async function handleInviteCollaborator() {
    try {
      const { token, share_url } = await api.collaboration.createInvite(tripId, 'edit');
      const title = trip?.title?.trim() || (lang === 'ko' ? '여행' : 'Trip');
      const me = useAuthStore.getState().user;

      // 카카오톡 공유 템플릿 우선 시도 — 실패 시 내부에서 OS Share로 폴백
      await shareInviteToKakao({
        token,
        tripTitle: title,
        inviterNickname: me?.nickname ?? (lang === 'ko' ? '친구' : 'Friend'),
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      Alert.alert(err?.response?.data?.message ?? '초대 링크 생성 실패');
    }
  }

  const days = totalDays();
  const groups = groupByDay(locations);
  const filtered = selectedDay === 'all' ? groups : groups.filter((g) => g.day === selectedDay);
  const sections = filtered.map((g) => ({ day: g.day, data: g.locations }));
  const mapLocs = (selectedDay === 'all'
    ? locations
    : locations.filter((l) => (l.day_index ?? 1) === selectedDay)
  ).filter((l) => l.latitude && l.longitude);

  if (loading) {
    return (
      <View style={[S.centered, { backgroundColor: colors.bgBase, paddingTop: insets.top }]}>
        <ActivityIndicator color={palette.coral500} size="large" />
        <Text style={{ color: colors.txSecondary, fontSize: 14, marginTop: 12 }}>
          {lang === 'ko' ? '여행 정보를 불러오는 중...' : 'Loading trip...'}
        </Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[S.centered, { backgroundColor: colors.bgBase, paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🧭</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.txPrimary, marginBottom: 8 }}>
          {lang === 'ko' ? '여행을 찾을 수 없어요' : 'Trip not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: palette.coral500, borderRadius: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{lang === 'ko' ? '돌아가기' : 'Go back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[S.wrap, { backgroundColor: colors.bgBase }]}>
      {/* 헤더 */}
      <View style={[S.hdr, { paddingTop: insets.top + 8, backgroundColor: colors.bgSurface, borderBottomColor: colors.lineDefault }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.txPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[S.hdrTitle, { color: colors.txPrimary }]} numberOfLines={1}>{trip.title}</Text>
          {(trip.start_date || trip.end_date) && (
            <Text style={{ color: colors.txSecondary, fontSize: 12, marginTop: 2 }}>
              {formatDate(trip.start_date, lang)}{trip.end_date ? ` → ${formatDate(trip.end_date, lang)}` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/trips/${tripId}/destination-guide?destination=${encodeURIComponent(trip.destination ?? trip.title)}`)}
          style={S.iconBtn}>
          <Text style={{ fontSize: 18 }}>📖</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleImageShare} style={S.iconBtn}>
          <Text style={{ fontSize: 18 }}>📸</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={S.iconBtn}>
          <Ionicons name="share-outline" size={20} color={colors.txPrimary} />
        </TouchableOpacity>
        {/* presence — 나 외 활성 협업자 아바타 (있을 때만) */}
        <PresenceStack
          users={activePresence}
          fallbackUserIds={activeCollaborators}
          myUserId={myUserId}
          size={26}
        />
        <TouchableOpacity onPress={handleInviteCollaborator} style={S.iconBtn}>
          <Ionicons name="people-outline" size={20} color={colors.txPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteTrip} style={S.iconBtn}>
          <Ionicons name="trash-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={() => (
          <>
            {/* 지도 */}
            {mapLocs.length > 0 && (
              <View style={S.mapWrap}>
                <MapView
                  style={S.map}
                  initialRegion={{
                    latitude: mapLocs[0].latitude,
                    longitude: mapLocs[0].longitude,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }}>
                  {mapLocs.map((loc) => (
                    <Marker
                      key={loc.id}
                      coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                      pinColor={palette.coral500}>
                      <Callout>
                        <View style={{ padding: 4, maxWidth: 180 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13 }}>{loc.name}</Text>
                          <Text style={{ fontSize: 11, color: '#666' }}>
                            {categoryEmoji(loc.category)} Day {loc.day_index} #{loc.visit_order}
                          </Text>
                        </View>
                      </Callout>
                    </Marker>
                  ))}
                </MapView>
                <View style={[S.mapBadge, { backgroundColor: `${palette.coral500}DD` }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>📍 {mapLocs.length}</Text>
                </View>
              </View>
            )}

            {/* Day 탭 */}
            {days > 1 && (
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={[S.dayTabs, { backgroundColor: colors.bgSurface, borderBottomColor: colors.lineDefault }]}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSelectedDay('all')}
                  style={[S.dayTab, { backgroundColor: selectedDay === 'all' ? palette.coral500 : (colors.bgSubtle) }]}>
                  <Text style={[S.dayTabTx, { color: selectedDay === 'all' ? '#fff' : colors.txSecondary }]}>
                    {lang === 'ko' ? '전체' : 'All'}
                  </Text>
                </TouchableOpacity>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity
                    key={d} onPress={() => setSelectedDay(d)}
                    style={[S.dayTab, { backgroundColor: selectedDay === d ? palette.coral500 : (colors.bgSubtle) }]}>
                    <Text style={[S.dayTabTx, { color: selectedDay === d ? '#fff' : colors.txSecondary }]}>Day {d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* 날씨 위젯 + 항공권 딥링크 */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
              <WeatherWidget destination={trip.destination ?? trip.title} />
              <TouchableOpacity
                onPress={() => openFlightSearch(trip.destination ?? trip.title, trip.start_date ?? undefined)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  borderRadius: 14, paddingVertical: 12,
                  backgroundColor: colors.accentBg,
                  borderWidth: 1, borderColor: colors.accentText,
                }}
                activeOpacity={0.85}>
                <Text style={{ fontSize: 16 }}>✈️</Text>
                <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 14 }}>
                  {lang === 'ko' ? '항공권 최저가 검색' : 'Search Cheap Flights'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 예산 카드 */}
            <View style={{ paddingHorizontal: 16 }}>
              <BudgetCard
                locations={locations}
                trip={trip}
                isDark={isDark}
                lang={lang}
                onUpdateBudget={async (budget) => {
                  await api.trips.update(tripId, { total_budget: budget ?? undefined });
                  tripQuery.refetch();
                }}
              />
            </View>

            {/* 체크리스트 */}
            <ChecklistSection tripId={tripId} isDark={isDark} lang={lang} />

            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
              <Text style={{ color: colors.txPrimary, fontSize: 16, fontWeight: '700' }}>
                {lang === 'ko' ? '📍 여행 일정' : '📍 Itinerary'}
              </Text>
            </View>
          </>
        )}
        renderSectionHeader={({ section }) => (
          <DaySectionHeader
            day={section.day}
            startDate={trip.start_date}
            locations={section.data}
            isDark={isDark}
            lang={lang}
          />
        )}
        renderItem={({ item, section }) => {
          const dayLocs = section.data
            .slice()
            .sort((a: Location, b: Location) => a.visit_order - b.visit_order);
          const idx = dayLocs.findIndex((l: Location) => l.id === item.id);
          return (
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              <RichLocationCard
                loc={item} isDark={isDark}
                onDelete={() => handleDeleteLocation(item)}
                onEdit={() => setEditingLoc(item)}
                onMoveUp={() => handleMoveLocation(item, 'up')}
                onMoveDown={() => handleMoveLocation(item, 'down')}
                canMoveUp={idx > 0}
                canMoveDown={idx < dayLocs.length - 1}
                highlighted={recentlyChangedLocId === item.id}
              />
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={S.empty}>
            <Text style={{ fontSize: 48 }}>🗺️</Text>
            <Text style={[S.emptyTitle, { color: colors.txPrimary }]}>
              {lang === 'ko' ? '아직 장소가 없어요' : 'No places yet'}
            </Text>
            <Text style={[S.emptyDesc, { color: colors.txSecondary }]}>
              {lang === 'ko' ? '+ 버튼을 눌러 첫 장소를 추가해보세요' : 'Tap + to add your first place'}
            </Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[S.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => {
          setDefaultDay(selectedDay === 'all' ? 1 : (selectedDay as number));
          setShowAdd(true);
        }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 장소 추가 모달 */}
      <AddLocationModal
        visible={showAdd} onClose={() => setShowAdd(false)}
        onSave={handleAddLocation} totalDays={days}
        defaultDay={defaultDay} isDark={isDark} lang={lang} mode="add"
      />

      {/* 장소 편집 모달 */}
      <AddLocationModal
        visible={editingLoc !== null}
        onClose={() => setEditingLoc(null)}
        onUpdate={handleUpdateLocation}
        totalDays={days}
        defaultDay={editingLoc?.day_index ?? 1}
        isDark={isDark} lang={lang} mode="edit"
        initialValues={editingLoc ? {
          name: editingLoc.name,
          address: editingLoc.address,
          latitude: editingLoc.latitude,
          longitude: editingLoc.longitude,
          category: editingLoc.category,
          day_index: editingLoc.day_index,
          notes: editingLoc.notes ?? '',
          estimated_minutes: editingLoc.estimated_minutes != null ? String(editingLoc.estimated_minutes) : '',
          budget_per_person: editingLoc.budget_per_person != null ? String(editingLoc.budget_per_person) : '',
          images: editingLoc.images ?? [],
        } : undefined}
      />

      {/* 일정 이미지 공유 카드 (화면 밖 렌더링) */}
      <ItineraryShareCard ref={shareCardRef} trip={trip} locations={locations} />
    </View>
  );
}

const S = StyleSheet.create({
  wrap:       { flex: 1 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hdr:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:    { width: 36, height: 36, justifyContent: 'center' },
  hdrTitle:   { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, flex: 1 },
  iconBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  mapWrap:    { height: 200, margin: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  map:        { flex: 1 },
  mapBadge:   { position: 'absolute', top: 10, right: 10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dayTabs:    { flexShrink: 0, borderBottomWidth: 1 },
  dayTab:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginVertical: 8 },
  dayTabTx:   { fontWeight: '600', fontSize: 13 },
  empty:      { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyDesc:  { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  fab:        { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: palette.coral500, justifyContent: 'center', alignItems: 'center', shadowColor: palette.coral500, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});
