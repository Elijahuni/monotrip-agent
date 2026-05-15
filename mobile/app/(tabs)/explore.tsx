/**
 * 탐색 화면 — AI 추천 + UP-8 여행 스타일 + UP-10 내 주변
 * 탭: ✨ AI 추천 | 📍 내 주변
 */

import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/LocationCard';
import { api } from '@/lib/api';
import { palette, shadow } from '@/lib/design-tokens';
import { type NearbyPlace, hasGoogleKey, searchNearbyPlaces } from '@/lib/geocoding';
import { saveTrip } from '@/lib/local-trips';
import { useSettings } from '@/lib/settings-context';
import type { Trip } from '@/lib/types';
import { AxiosError } from 'axios';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface AiLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  visit_order: number;
  day_index?: number;
  notes: string | null;
  estimated_minutes?: number | null;
  budget_per_person?: number | null;
}

interface AiResult {
  title: string;
  description: string;
  locations: AiLocation[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

// UP-8: 여행 스타일
const TRAVEL_STYLES = [
  { key: 'history',  label: '🏛️ 역사/문화', labelEn: '🏛️ History' },
  { key: 'food',     label: '🍜 미식',       labelEn: '🍜 Food' },
  { key: 'shopping', label: '🛍️ 쇼핑',      labelEn: '🛍️ Shopping' },
  { key: 'nature',   label: '🌿 자연',       labelEn: '🌿 Nature' },
  { key: 'activity', label: '🎢 액티비티',   labelEn: '🎢 Activity' },
];

// UP-10: 근처 보기 카테고리
const NEARBY_CATS = [
  { label: '전체',   type: '',                 emoji: '🗺️' },
  { label: '맛집',   type: 'restaurant',       emoji: '🍜' },
  { label: '카페',   type: 'cafe',             emoji: '☕' },
  { label: '관광지', type: 'tourist_attraction',emoji: '🏛️' },
  { label: '쇼핑',   type: 'shopping_mall',    emoji: '🛍️' },
];

const CATEGORY_ICONS: Record<string, string> = {
  숙소: '🏨', 음식점: '🍜', 관광지: '🗺️',
  카페: '☕', 쇼핑: '🛍️', 자연: '🌿',
  문화: '🏛️', 엔터테인먼트: '🎭', 액티비티: '🎢',
};

function categoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? '📍';
}

// ─── 일수 선택기 ───────────────────────────────────────────────────────────────

function DaySelector({ value, onChange, isDark }: {
  value: number; onChange: (n: number) => void; isDark: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
      {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity
          key={n}
          style={{
            marginHorizontal: 4, width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: value === n ? palette.coral500 : (isDark ? '#1E1E2E' : '#F0F4F8'),
          }}
          onPress={() => onChange(n)}
          activeOpacity={0.8}>
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: value === n ? '#fff' : (isDark ? '#9BA7B5' : '#5A6474'),
          }}>
            {n}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── UP-10: 근처 장소 카드 ─────────────────────────────────────────────────────

function NearbyCard({
  place, isDark, onSave, saving,
}: {
  place: NearbyPlace; isDark: boolean; onSave: (p: NearbyPlace) => void; saving: boolean;
}) {
  const txP = isDark ? '#E8EDF2' : '#1A2E44';
  const txT = isDark ? '#6B7785' : '#9BA7B5';
  const bg  = isDark ? '#161622' : '#FFFFFF';
  const brd = isDark ? '#2A2A3E' : '#E8ECF2';
  const stars = place.rating != null ? '⭐ ' + place.rating.toFixed(1) : '';
  const openLabel = place.open_now === true ? '영업 중' : place.open_now === false ? '영업 종료' : '';
  const openColor = place.open_now === true ? '#27AE60' : '#E74C3C';

  return (
    <View style={{
      backgroundColor: bg, borderRadius: 16, borderWidth: 1, borderColor: brd,
      marginBottom: 12, padding: 14,
      shadowColor: isDark ? '#000' : '#1A2E44',
      shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Text style={{ fontSize: 20 }}>{categoryIcon(place.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: txP, fontSize: 15, fontWeight: '700', lineHeight: 20 }} numberOfLines={1}>{place.name}</Text>
          <Text style={{ color: txT, fontSize: 12, marginTop: 2 }} numberOfLines={1}>📍 {place.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: isDark ? '#9BA7B5' : '#FF5A5F', fontSize: 11, fontWeight: '600' }}>{place.category}</Text>
            </View>
            {stars ? (
              <View style={{ backgroundColor: isDark ? '#2A2A1A' : '#FFFDE7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#F39C12', fontSize: 11, fontWeight: '700' }}>{stars}</Text>
              </View>
            ) : null}
            {openLabel ? (
              <View style={{ backgroundColor: isDark ? (place.open_now ? '#0D2A1A' : '#2A0D0D') : (place.open_now ? '#EAFAF1' : '#FDECEA'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: openColor, fontSize: 11, fontWeight: '600' }}>{openLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSave(place)}
        disabled={saving}
        style={{
          marginTop: 12, borderRadius: 10, paddingVertical: 10,
          backgroundColor: saving ? (isDark ? '#1E1E2E' : '#F0F4F8') : palette.coral500,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
        }}
        activeOpacity={0.8}>
        {saving
          ? <ActivityIndicator color={isDark ? '#6B7785' : '#9BA7B5'} size="small" />
          : <>
              <Ionicons name="heart-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>보관함에 저장</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── 메인 화면 ─────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isDark, lang } = useSettings();

  // ── 탭
  const [activeTab, setActiveTab] = useState<'ai' | 'nearby'>('ai');

  // ── AI 추천 상태
  const [destination, setDestination] = useState('');
  const [days, setDays]               = useState(3);
  const [preferences, setPreferences] = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [result, setResult]           = useState<AiResult | null>(null);
  const [aiError, setAiError]         = useState('');

  // ── UP-10 근처 상태
  const [nearbyLoading, setNearbyLoading]   = useState(false);
  const [nearbyPlaces, setNearbyPlaces]     = useState<NearbyPlace[]>([]);
  const [nearbyCat, setNearbyCat]           = useState(0);
  const [nearbyError, setNearbyError]       = useState('');
  const [savingPlaceId, setSavingPlaceId]   = useState<string | null>(null);
  const [userLocation, setUserLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const didLoadNearby                       = useRef(false);

  // ── 색상 토큰
  const bgBase   = isDark ? '#0D0D18' : '#FFFFFF';
  const bgSurface = isDark ? '#13131F' : '#F8FAFB';
  const bgSubtle = isDark ? '#1E1E2E' : '#F0F4F8';
  const txPri    = isDark ? '#E8EEF4' : '#1A2E44';
  const txSec    = isDark ? '#9BA7B5' : '#5A6474';
  const txTer    = isDark ? '#6B7785' : '#9BA7B5';
  const borderC  = isDark ? '#2A2A3E' : '#E8ECF2';
  const cardShadow = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 2 }
    : shadow.card;

  // ─── AI 추천 핸들러 ──────────────────────────────────────────────────────────

  async function handleRecommend() {
    const dest = destination.trim();
    if (!dest) { setAiError(t('explore', 'fillDest')); return; }
    setAiError(''); setResult(null); setLoading(true);
    try {
      const data = await api.ai.recommend({
        destination: dest, days,
        preferences: preferences.trim() || undefined,
        travel_style: travelStyle || undefined,
      });
      setResult(data as AiResult);
    } catch (e) {
      const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
      setAiError(msg);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const trip = await api.trips.create({
        title: result.title,
        description: result.description,
        locations: result.locations.map((loc, i) => ({
          name: loc.name, address: loc.address,
          latitude: loc.latitude, longitude: loc.longitude,
          category: loc.category, visit_order: loc.visit_order || i + 1,
          notes: loc.notes,
        })),
      });
      await saveTrip(trip as Trip);
      Alert.alert(`${t('explore', 'saved')} ✈️`, `"${result.title}" ${t('explore', 'savedMsg')}`, [
        { text: t('explore', 'goTrips'), onPress: () => { router.navigate('/(tabs)'); setResult(null); setDestination(''); setPreferences(''); setTravelStyle(''); } },
        { text: t('common', 'cancel'), style: 'cancel' },
      ]);
    } catch (e) {
      const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
      Alert.alert(t('common', 'error'), msg);
    } finally { setSaving(false); }
  }

  /** AI 플랜 빌더로 이동 — 부분 선택/일자별 배치/재생성 */
  function handleEdit() {
    if (!result) return;
    const planParam = encodeURIComponent(JSON.stringify(result));
    router.push(
      `/ai/builder?plan=${planParam}&destination=${encodeURIComponent(destination.trim())}&days=${days}&preferences=${encodeURIComponent(preferences.trim())}` as never,
    );
  }

  // ─── UP-10 핸들러 ────────────────────────────────────────────────────────────

  async function loadNearby(catIdx = nearbyCat, loc?: { lat: number; lng: number }) {
    const useLoc = loc ?? userLocation;
    if (!useLoc) return;
    setNearbyLoading(true); setNearbyError('');
    try {
      if (!hasGoogleKey()) {
        setNearbyError('Google Maps API 키가 설정되지 않았습니다.\n.env의 EXPO_PUBLIC_GOOGLE_MAPS_KEY를 확인해주세요.');
        return;
      }
      const cat = NEARBY_CATS[catIdx];
      const places = await searchNearbyPlaces(useLoc.lat, useLoc.lng, 1500, cat.type || undefined);
      setNearbyPlaces(places);
      if (places.length === 0) setNearbyError('주변에 검색된 장소가 없습니다.');
    } catch {
      setNearbyError('장소를 불러오지 못했습니다.');
    } finally { setNearbyLoading(false); }
  }

  async function requestLocationAndLoad() {
    setNearbyLoading(true); setNearbyError('');
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearbyError('위치 권한이 필요합니다.\n설정 > 개인정보 보호에서 허용해주세요.');
        setNearbyLoading(false);
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      didLoadNearby.current = true;
      await loadNearby(nearbyCat, loc);
    } catch {
      setNearbyError('위치를 가져오지 못했습니다.');
      setNearbyLoading(false);
    }
  }

  async function handleNearbyTabPress() {
    setActiveTab('nearby');
    if (!didLoadNearby.current && !userLocation) {
      await requestLocationAndLoad();
    }
  }

  async function handleSaveNearby(place: NearbyPlace) {
    setSavingPlaceId(place.place_id);
    try {
      await api.saved_places.save({
        name: place.name, address: place.address,
        latitude: place.latitude, longitude: place.longitude,
        category: place.category, rating: place.rating,
        google_place_id: place.place_id,
        notes: null, images: null, website: null, phone: null, estimated_minutes: null,
      });
      Alert.alert('보관함에 저장됐어요 ❤️', `"${place.name}"이 보관함에 추가됐습니다.`);
    } catch (e) {
      const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
      Alert.alert(t('common', 'error'), msg);
    } finally { setSavingPlaceId(null); }
  }

  const canRecommend = destination.trim().length > 0 && !loading;

  // ─── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: bgSurface, paddingTop: insets.top }}>

      {/* 헤더 + 탭 */}
      <View style={{ backgroundColor: bgBase, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: borderC }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: txPri }}>{t('explore', 'title')}</Text>
        <Text style={{ fontSize: 12, color: txTer, marginTop: 2 }}>{t('explore', 'subtitle')}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {[
            { key: 'ai' as const,     label: `✨ ${lang === 'ko' ? 'AI 추천' : 'AI Suggest'}` },
            { key: 'nearby' as const, label: `📍 ${lang === 'ko' ? '내 주변' : 'Nearby'}` },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={key === 'nearby' ? handleNearbyTabPress : () => setActiveTab('ai')}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                backgroundColor: activeTab === key ? palette.coral500 : bgSubtle,
              }}
              activeOpacity={0.85}>
              <Text style={{ color: activeTab === key ? '#fff' : txSec, fontSize: 14, fontWeight: '700' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── AI 추천 탭 ─────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          {/* 입력 폼 */}
          <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: bgBase, borderRadius: 20, padding: 20, ...cardShadow }}>

            <Text style={{ fontSize: 12, fontWeight: '600', color: txSec, marginBottom: 6 }}>{t('explore', 'destination')}</Text>
            <TextInput
              style={{ backgroundColor: bgSurface, borderWidth: 1, borderColor: borderC, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: txPri }}
              placeholder={t('explore', 'destHolder')}
              placeholderTextColor={txTer}
              value={destination}
              onChangeText={(v) => { setDestination(v); if (aiError) setAiError(''); }}
              autoCapitalize="none"
              returnKeyType="done"
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: txSec }}>{t('explore', 'days')}</Text>
              <View style={{ backgroundColor: palette.coral500, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{days}{t('explore', 'day')}</Text>
              </View>
            </View>
            <DaySelector value={days} onChange={setDays} isDark={isDark} />

            {/* UP-8: 여행 스타일 */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: txSec, marginTop: 20, marginBottom: 10 }}>
              {lang === 'ko' ? '여행 스타일' : 'Travel Style'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TRAVEL_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setTravelStyle(travelStyle === s.key ? '' : s.key)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                      backgroundColor: travelStyle === s.key ? palette.coral500 : bgSubtle,
                      borderColor: travelStyle === s.key ? palette.coral500 : borderC,
                    }}>
                    <Text style={{ color: travelStyle === s.key ? '#fff' : txSec, fontSize: 13, fontWeight: '600' }}>
                      {lang === 'ko' ? s.label : s.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 12, fontWeight: '600', color: txSec, marginTop: 16, marginBottom: 6 }}>{t('explore', 'preferences')}</Text>
            <TextInput
              style={{ backgroundColor: bgSurface, borderWidth: 1, borderColor: borderC, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: txPri }}
              placeholder={t('explore', 'prefHolder')}
              placeholderTextColor={txTer}
              value={preferences}
              onChangeText={setPreferences}
              returnKeyType="done"
            />

            {aiError ? (
              <View style={{ marginTop: 12, backgroundColor: isDark ? '#2A0D0D' : '#FFF0F0', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: isDark ? '#5A1A1A' : '#FFDDD9' }}>
                <Text style={{ color: '#E74C3C', fontSize: 13, textAlign: 'center' }}>{aiError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={{ marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: canRecommend ? palette.coral500 : bgSubtle }}
              onPress={handleRecommend} disabled={!canRecommend} activeOpacity={0.85}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{t('explore', 'recommending')}</Text>
                </View>
              ) : (
                <Text style={{ color: canRecommend ? '#fff' : txTer, fontWeight: '800', fontSize: 15 }}>
                  ✨ {t('explore', 'recommend')}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 로딩 */}
          {loading && (
            <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: bgBase, borderRadius: 20, padding: 32, alignItems: 'center', ...cardShadow }}>
              <ActivityIndicator size="large" color={palette.coral500} />
              <Text style={{ color: txPri, fontWeight: '700', fontSize: 15, marginTop: 16 }}>{t('explore', 'recommending')}</Text>
              <Text style={{ color: txTer, fontSize: 13, marginTop: 4, textAlign: 'center' }}>{destination.trim()} {days}{t('explore', 'day')}…</Text>
            </View>
          )}

          {/* 추천 결과 */}
          {result && !loading && (
            <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', ...cardShadow }}>
              {/* 결과 헤더 */}
              <View style={{ backgroundColor: palette.coral500, paddingHorizontal: 20, paddingVertical: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' }}>✨ AI 추천 일정</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 26 }}>{result.title}</Text>
                {result.description ? (
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8, lineHeight: 20 }}>{result.description}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>총 {result.locations.length}개 장소</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{days}일 일정</Text>
                  </View>
                </View>
              </View>

              {/* 장소 목록 */}
              <View style={{ backgroundColor: bgSurface, paddingHorizontal: 16 }}>
                {result.locations.length > 0 ? (
                  result.locations.map((loc, i) => (
                    <LocationCard key={`${loc.name}-${i}`} loc={loc} index={i} />
                  ))
                ) : (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Text style={{ color: txTer, fontSize: 13 }}>{t('explore', 'noResult')}</Text>
                  </View>
                )}
              </View>

              {/* 액션 버튼 3개 */}
              <View style={{ backgroundColor: bgBase, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10, borderTopWidth: 1, borderTopColor: borderC }}>
                <TouchableOpacity
                  onPress={handleEdit}
                  style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: palette.coral500 }}
                  activeOpacity={0.85}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✏️ 일정 편집 (선택·배치·재생성)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: bgSubtle }}
                  activeOpacity={0.85}>
                  {saving
                    ? <ActivityIndicator color={txSec} />
                    : <Text style={{ color: txSec, fontWeight: '700', fontSize: 14 }}>{t('explore', 'saveTrip')}</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setResult(null); setAiError(''); }}
                  style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
                  activeOpacity={0.85}>
                  <Text style={{ color: txSec, fontWeight: '600', fontSize: 14 }}>↩ {lang === 'ko' ? '다시 추천받기' : 'Try Again'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ─── 내 주변 탭 (UP-10) ──────────────────────────────────────────────── */}
      {activeTab === 'nearby' && (
        <View style={{ flex: 1 }}>
          {/* 카테고리 칩 */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: borderC }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' }}>
            {NEARBY_CATS.map((cat, idx) => (
              <TouchableOpacity
                key={cat.label}
                onPress={async () => { setNearbyCat(idx); if (userLocation) await loadNearby(idx); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                  backgroundColor: nearbyCat === idx ? palette.coral500 : bgSubtle,
                  borderColor: nearbyCat === idx ? palette.coral500 : borderC,
                }}
                activeOpacity={0.8}>
                <Text style={{ color: nearbyCat === idx ? '#fff' : txSec, fontSize: 13, fontWeight: '700' }}>
                  {cat.emoji} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {nearbyLoading && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={palette.coral500} />
              <Text style={{ color: txSec, fontSize: 14 }}>주변 장소를 불러오는 중…</Text>
            </View>
          )}

          {!nearbyLoading && nearbyError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
              <Text style={{ fontSize: 48 }}>📍</Text>
              <Text style={{ color: txPri, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                {userLocation ? '장소를 불러오지 못했습니다' : '현재 위치가 필요해요'}
              </Text>
              <Text style={{ color: txSec, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{nearbyError}</Text>
              <TouchableOpacity
                onPress={requestLocationAndLoad}
                style={{ backgroundColor: palette.coral500, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {userLocation ? '다시 시도' : '위치 권한 허용'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!nearbyLoading && !nearbyError && !userLocation && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
              <Text style={{ fontSize: 56 }}>📍</Text>
              <Text style={{ color: txPri, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>내 주변 장소 탐색</Text>
              <Text style={{ color: txSec, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                현재 위치 기반으로{'\n'}주변 맛집, 카페, 관광지를 찾아드려요
              </Text>
              <TouchableOpacity
                onPress={requestLocationAndLoad}
                style={{ backgroundColor: palette.coral500, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
                activeOpacity={0.85}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>📍 내 위치로 탐색 시작</Text>
              </TouchableOpacity>
            </View>
          )}

          {!nearbyLoading && !nearbyError && nearbyPlaces.length === 0 && userLocation && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={{ fontSize: 40 }}>🗺️</Text>
              <Text style={{ color: txSec, fontSize: 14 }}>주변에 장소가 없어요</Text>
            </View>
          )}

          {!nearbyLoading && nearbyPlaces.length > 0 && (
            <FlatList
              data={nearbyPlaces}
              keyExtractor={(item) => item.place_id}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.coral500 }} />
                  <Text style={{ color: txSec, fontSize: 13, fontWeight: '600' }}>내 주변 {nearbyPlaces.length}곳</Text>
                  <TouchableOpacity
                    onPress={() => loadNearby()}
                    style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: bgSubtle, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Ionicons name="refresh" size={12} color={txSec} />
                    <Text style={{ color: txSec, fontSize: 12, fontWeight: '600' }}>새로고침</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <NearbyCard
                  place={item} isDark={isDark}
                  onSave={handleSaveNearby}
                  saving={savingPlaceId === item.place_id}
                />
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}
