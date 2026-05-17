import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { deleteSavedPlace, getSavedPlaces, syncSavedPlaces } from '@/lib/local-trips';
import { getUserCache, type CachedUser } from '@/lib/local-user';
import { useSettings } from '@/lib/settings-context';
import type { SavedPlace, Trip } from '@/lib/types';

const CATEGORY_ICONS: Record<string, string> = {
  숙소: '🏨', 음식점: '🍜', 관광지: '🗺️',
  카페: '☕', 쇼핑: '🛍️', 자연: '🌿',
  문화: '🏛️', 엔터테인먼트: '🎭',
};

function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📍';
}

// ─── AddToTripModal ────────────────────────────────────────────────────────────

function AddToTripModal({
  visible,
  place,
  onClose,
  onAdded,
  isDark,
}: {
  visible: boolean;
  place: SavedPlace | null;
  onClose: () => void;
  onAdded: () => void;
  isDark: boolean;
}) {
  const { t } = useSettings();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const bgBase  = isDark ? '#0D0D18' : '#FFFFFF';
  const bgSurf  = isDark ? '#13131F' : '#F8FAFB';
  const txPri   = isDark ? '#E8EEF4' : '#1A2E44';
  const txSec   = isDark ? '#9BA7B5' : '#5A6474';
  const txTer   = isDark ? '#6B7785' : '#9BA7B5';
  const border  = isDark ? '#2A2A3E' : '#E8ECF2';

  useEffect(() => {
    if (!visible) return;
    setSelectedTrip(null);
    setSelectedDay(1);
    setLoading(true);
    api.trips.getAll({ limit: 100 })
      .then((page) => setTrips(page.items))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [visible]);

  async function handleAdd() {
    if (!place || !selectedTrip) return;
    setSaving(true);
    try {
      await api.saved_places.addToTrip(place.id, {
        trip_id: selectedTrip.id,
        day_index: selectedDay,
        visit_order: 99,
      });
      Alert.alert(t('savedTab', 'added'), `"${place.name}"이(가) ${selectedTrip.title} Day ${selectedDay}에 추가됐어요.`);
      onAdded();
      onClose();
    } catch (e) {
      const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
      Alert.alert(t('common', 'error'), msg);
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: bgBase, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
          {/* 핸들 */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border, alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontSize: 18, fontWeight: '800', color: txPri, marginBottom: 4 }}>
            {t('savedTab', 'addToTrip')}
          </Text>
          {place && (
            <Text style={{ fontSize: 13, color: txSec, marginBottom: 20 }}>{place.name}</Text>
          )}

          {loading ? (
            <ActivityIndicator color="#3DC3EE" style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {/* 여행 선택 */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: txTer, marginBottom: 10 }}>
                {t('savedTab', 'selectTrip')}
              </Text>
              {trips.length === 0 ? (
                <Text style={{ color: txTer, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>여행이 없습니다.</Text>
              ) : (
                trips.map((tr) => (
                  <TouchableOpacity
                    key={tr.id}
                    onPress={() => setSelectedTrip(tr)}
                    style={{
                      padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 2,
                      backgroundColor: selectedTrip?.id === tr.id ? '#E8F8FD' : bgSurf,
                      borderColor: selectedTrip?.id === tr.id ? '#3DC3EE' : border,
                    }}>
                    <Text style={{ color: selectedTrip?.id === tr.id ? '#3DC3EE' : txPri, fontWeight: '700', fontSize: 14 }}>
                      {tr.title}
                    </Text>
                    {tr.start_date && (
                      <Text style={{ color: txTer, fontSize: 11, marginTop: 2 }}>{tr.start_date}</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* 날짜 선택 */}
              {selectedTrip && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: txTer, marginTop: 16, marginBottom: 10 }}>
                    {t('savedTab', 'selectDay')}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setSelectedDay(d)}
                          style={{
                            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
                            backgroundColor: selectedDay === d ? '#3DC3EE' : bgSurf,
                            borderColor: selectedDay === d ? '#3DC3EE' : border,
                          }}>
                          <Text style={{ color: selectedDay === d ? '#fff' : txSec, fontWeight: '700', fontSize: 13 }}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={handleAdd}
            disabled={!selectedTrip || saving}
            style={{
              marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
              backgroundColor: selectedTrip && !saving ? '#3DC3EE' : (isDark ? '#1E1E2E' : '#E8ECF2'),
            }}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: selectedTrip ? '#fff' : txTer, fontWeight: '800', fontSize: 15 }}>
                  {t('savedTab', 'addToTrip')}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: txSec, fontWeight: '600' }}>{t('common', 'cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── SavedPlaceCard ────────────────────────────────────────────────────────────

function SavedPlaceCard({
  place,
  onAddToTrip,
  onRemove,
  isDark,
}: {
  place: SavedPlace;
  onAddToTrip: (p: SavedPlace) => void;
  onRemove: (p: SavedPlace) => void;
  isDark: boolean;
}) {
  const { t } = useSettings();
  const bgBase  = isDark ? '#13131F' : '#FFFFFF';
  const txPri   = isDark ? '#E8EEF4' : '#1A2E44';
  const txSec   = isDark ? '#9BA7B5' : '#5A6474';
  const txTer   = isDark ? '#6B7785' : '#9BA7B5';
  const border  = isDark ? '#2A2A3E' : '#E8ECF2';
  const shadow  = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 2 }
    : { shadowColor: '#1A2E44', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 };

  return (
    <View style={{ backgroundColor: bgBase, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, ...shadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {/* 카테고리 아이콘 */}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F8FD', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(place.category)}</Text>
        </View>

        {/* 정보 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 11, color: txTer }}>{place.category}</Text>
            {place.rating != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 10, color: '#F39C12' }}>★</Text>
                <Text style={{ fontSize: 11, color: txTer }}>{place.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: txPri, marginBottom: 2 }}>{place.name}</Text>
          <Text style={{ fontSize: 12, color: txTer }} numberOfLines={1}>📍 {place.address}</Text>
          {place.notes && (
            <Text style={{ fontSize: 12, color: txSec, marginTop: 4 }} numberOfLines={2}>{place.notes}</Text>
          )}
          {/* 시간/예산 배지 */}
          {place.estimated_minutes != null && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <View style={{ backgroundColor: isDark ? '#1E1E2E' : '#E8F8FD', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#3DC3EE', fontSize: 11 }}>
                  ⏱ {place.estimated_minutes >= 60 ? `${Math.floor(place.estimated_minutes / 60)}h` : `${place.estimated_minutes}m`}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: border, paddingTop: 12 }}>
        <TouchableOpacity
          onPress={() => onAddToTrip(place)}
          style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#3DC3EE' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>✈️ {t('savedTab', 'addToTrip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onRemove(place)}
          style={{ borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0', borderWidth: 1, borderColor: isDark ? '#2A2A3E' : '#FFDDD9' }}>
          <Text style={{ color: '#E74C3C', fontWeight: '700', fontSize: 13 }}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 보관함 화면 ───────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark } = useSettings();

  const [cachedUser, setCachedUser] = useState<CachedUser | null>(null);
  const [places, setPlaces]       = useState<SavedPlace[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState<SavedPlace | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    getUserCache().then(setCachedUser);
  }, []);

  const bgBase  = isDark ? '#0D0D18' : '#F8FAFB';
  const bgSurf  = isDark ? '#13131F' : '#FFFFFF';
  const txPri   = isDark ? '#E8EEF4' : '#1A2E44';
  const txTer   = isDark ? '#6B7785' : '#9BA7B5';
  const border  = isDark ? '#2A2A3E' : '#E8ECF2';

  const loadLocal = useCallback(async () => {
    const cu = cachedUser ?? await getUserCache();
    if (!cu) return;
    const local = await getSavedPlaces(cu.user_id);
    setPlaces(local);
  }, [cachedUser]);

  const syncRemote = useCallback(async () => {
    const cu = cachedUser ?? await getUserCache();
    if (!cu) return;
    try {
      const remote = await api.saved_places.getAll();
      await syncSavedPlaces(cu.user_id, remote);
      setPlaces(remote);
    } catch { /* 오프라인이면 로컬 유지 */ }
  }, [cachedUser]);

  useEffect(() => {
    loadLocal().then(() => setLoading(false)).then(syncRemote);
  }, [loadLocal, syncRemote]);

  async function handleRefresh() {
    setRefreshing(true);
    await syncRemote();
    setRefreshing(false);
  }

  function handleAddToTrip(place: SavedPlace) {
    setSelected(place);
    setModalVisible(true);
  }

  async function handleRemove(place: SavedPlace) {
    Alert.alert(
      t('savedTab', 'remove'),
      `"${place.name}"을(를) 보관함에서 삭제할까요?`,
      [
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.saved_places.remove(place.id);
              await deleteSavedPlace(place.id);
              setPlaces((prev) => prev.filter((p) => p.id !== place.id));
            } catch (e) {
              const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
              Alert.alert(t('common', 'error'), msg);
            }
          },
        },
        { text: t('common', 'cancel'), style: 'cancel' },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgBase, paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{ backgroundColor: bgSurf, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: border }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: txPri }}>{t('savedTab', 'title')}</Text>
        <Text style={{ fontSize: 12, color: txTer, marginTop: 2 }}>{t('savedTab', 'subtitle')}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3DC3EE" />
        </View>
      ) : places.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🗂️</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: txPri, marginBottom: 8, textAlign: 'center' }}>{t('savedTab', 'empty')}</Text>
          <Text style={{ fontSize: 13, color: txTer, textAlign: 'center', lineHeight: 20 }}>{t('savedTab', 'emptySub')}</Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3DC3EE"
              title={isDark ? undefined : '업데이트 중...'}
            />
          }
          renderItem={({ item }) => (
            <SavedPlaceCard
              place={item}
              onAddToTrip={handleAddToTrip}
              onRemove={handleRemove}
              isDark={isDark}
            />
          )}
        />
      )}

      <AddToTripModal
        visible={modalVisible}
        place={selected}
        onClose={() => setModalVisible(false)}
        onAdded={() => {}}
        isDark={isDark}
      />
    </View>
  );
}
