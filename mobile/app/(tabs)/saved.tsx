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
import { shadow, useThemedColors } from '@/lib/design-tokens';
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
}: {
  visible: boolean;
  place: SavedPlace | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useSettings();
  const colors = useThemedColors();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        <View style={{ backgroundColor: colors.bgSurface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
          {/* 핸들 */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginBottom: 4 }}>
            {t('savedTab', 'addToTrip')}
          </Text>
          {place && (
            <Text style={{ fontSize: 13, color: colors.txSecondary, marginBottom: 20 }}>{place.name}</Text>
          )}

          {loading ? (
            <ActivityIndicator color={colors.brandSecondary} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {/* 여행 선택 */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.txTertiary, marginBottom: 10 }}>
                {t('savedTab', 'selectTrip')}
              </Text>
              {trips.length === 0 ? (
                <Text style={{ color: colors.txTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>여행이 없습니다.</Text>
              ) : (
                trips.map((tr) => (
                  <TouchableOpacity
                    key={tr.id}
                    onPress={() => setSelectedTrip(tr)}
                    style={{
                      padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 2,
                      backgroundColor: selectedTrip?.id === tr.id ? colors.accentBg : colors.bgSubtle,
                      borderColor: selectedTrip?.id === tr.id ? colors.accentText : colors.lineDefault,
                    }}>
                    <Text style={{ color: selectedTrip?.id === tr.id ? colors.accentText : colors.txPrimary, fontWeight: '700', fontSize: 14 }}>
                      {tr.title}
                    </Text>
                    {tr.start_date && (
                      <Text style={{ color: colors.txTertiary, fontSize: 11, marginTop: 2 }}>{tr.start_date}</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* 날짜 선택 */}
              {selectedTrip && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.txTertiary, marginTop: 16, marginBottom: 10 }}>
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
                            backgroundColor: selectedDay === d ? colors.accentText : colors.bgSubtle,
                            borderColor: selectedDay === d ? colors.accentText : colors.lineDefault,
                          }}>
                          <Text style={{ color: selectedDay === d ? '#fff' : colors.txSecondary, fontWeight: '700', fontSize: 13 }}>{d}</Text>
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
              backgroundColor: selectedTrip && !saving ? colors.brandSecondary : colors.bgStrong,
            }}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: selectedTrip ? '#fff' : colors.txTertiary, fontWeight: '800', fontSize: 15 }}>
                  {t('savedTab', 'addToTrip')}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ color: colors.txSecondary, fontWeight: '600' }}>{t('common', 'cancel')}</Text>
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
}: {
  place: SavedPlace;
  onAddToTrip: (p: SavedPlace) => void;
  onRemove: (p: SavedPlace) => void;
}) {
  const { t } = useSettings();
  const colors = useThemedColors();
  const cardShadow = { ...shadow.card, shadowColor: colors.shadowColor };

  return (
    <View style={{ backgroundColor: colors.bgSurface, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, ...cardShadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {/* 카테고리 아이콘 */}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(place.category)}</Text>
        </View>

        {/* 정보 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 11, color: colors.txTertiary }}>{place.category}</Text>
            {place.rating != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 10, color: '#F59E0B' }}>★</Text>
                <Text style={{ fontSize: 11, color: colors.txTertiary }}>{place.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.txPrimary, marginBottom: 2 }}>{place.name}</Text>
          <Text style={{ fontSize: 12, color: colors.txTertiary }} numberOfLines={1}>📍 {place.address}</Text>
          {place.notes && (
            <Text style={{ fontSize: 12, color: colors.txSecondary, marginTop: 4 }} numberOfLines={2}>{place.notes}</Text>
          )}
          {/* 시간/예산 배지 */}
          {place.estimated_minutes != null && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <View style={{ backgroundColor: colors.accentBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.accentText, fontSize: 11 }}>
                  ⏱ {place.estimated_minutes >= 60 ? `${Math.floor(place.estimated_minutes / 60)}h` : `${place.estimated_minutes}m`}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.lineDefault, paddingTop: 12 }}>
        <TouchableOpacity
          onPress={() => onAddToTrip(place)}
          style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.brandSecondary }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>✈️ {t('savedTab', 'addToTrip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onRemove(place)}
          style={{ borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgSubtle, borderWidth: 1, borderColor: colors.lineDefault }}>
          <Text style={{ color: colors.txDanger, fontWeight: '700', fontSize: 13 }}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 보관함 화면 ───────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useSettings();
  const colors = useThemedColors();

  const [cachedUser, setCachedUser] = useState<CachedUser | null>(null);
  const [places, setPlaces]       = useState<SavedPlace[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState<SavedPlace | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    getUserCache().then(setCachedUser);
  }, []);

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
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{ backgroundColor: colors.bgSurface, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.lineDefault }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.txPrimary }}>{t('savedTab', 'title')}</Text>
        <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>{t('savedTab', 'subtitle')}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.brandSecondary} />
        </View>
      ) : places.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🗂️</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary, marginBottom: 8, textAlign: 'center' }}>{t('savedTab', 'empty')}</Text>
          <Text style={{ fontSize: 13, color: colors.txTertiary, textAlign: 'center', lineHeight: 20 }}>{t('savedTab', 'emptySub')}</Text>
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
              tintColor={colors.brandSecondary}
            />
          }
          renderItem={({ item }) => (
            <SavedPlaceCard
              place={item}
              onAddToTrip={handleAddToTrip}
              onRemove={handleRemove}
            />
          )}
        />
      )}

      <AddToTripModal
        visible={modalVisible}
        place={selected}
        onClose={() => setModalVisible(false)}
        onAdded={() => {}}
      />
    </View>
  );
}
