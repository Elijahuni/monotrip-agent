import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AxiosError } from 'axios';

import { api } from '@/lib/api';
import { palette, shadow, useThemedColors } from '@/lib/design-tokens';
import { type NearbyPlace, hasGoogleKey, searchNearbyPlaces } from '@/lib/geocoding';
import { saveTrip } from '@/lib/local-trips';
import { useSettings } from '@/lib/settings-context';
import type { Trip, WeatherDestination } from '@/lib/types';
import { fetchWeather } from '@/lib/weather';
import { AiRecommendTab, type AiResult } from '@/components/explore/AiRecommendTab';
import { WeatherTab } from '@/components/explore/WeatherTab';
import { NearbyTab } from '@/components/explore/NearbyTab';

const NEARBY_CATS = [
  { label: '전체',   type: '',                  emoji: '🗺️' },
  { label: '맛집',   type: 'restaurant',        emoji: '🍜' },
  { label: '카페',   type: 'cafe',              emoji: '☕' },
  { label: '관광지', type: 'tourist_attraction', emoji: '🏛️' },
  { label: '쇼핑',   type: 'shopping_mall',     emoji: '🛍️' },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isDark, lang } = useSettings();
  const colors = useThemedColors();

  const [activeTab, setActiveTab] = useState<'ai' | 'weather' | 'nearby'>('ai');

  // AI 추천 상태
  const [destination, setDestination] = useState('');
  const [days, setDays]               = useState(3);
  const [preferences, setPreferences] = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [result, setResult]           = useState<AiResult | null>(null);
  const [aiError, setAiError]         = useState('');

  // 날씨로 찾기 상태
  const [weatherCondition, setWeatherCondition]       = useState('');
  const [weatherSearching, setWeatherSearching]       = useState(false);
  const [weatherDestinations, setWeatherDestinations] = useState<WeatherDestination[]>([]);
  const [weatherSearchError, setWeatherSearchError]   = useState('');

  // 내 주변 상태
  const [nearbyLoading, setNearbyLoading]   = useState(false);
  const [nearbyPlaces, setNearbyPlaces]     = useState<NearbyPlace[]>([]);
  const [nearbyCat, setNearbyCat]           = useState(0);
  const [nearbyError, setNearbyError]       = useState('');
  const [savingPlaceId, setSavingPlaceId]   = useState<string | null>(null);
  const [userLocation, setUserLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const didLoadNearby                       = useRef(false);

  // 색상 토큰 (design-tokens 기반)
  const cardShadow = { ...shadow.card, shadowColor: colors.shadowColor };

  const theme = {
    isDark,
    bgBase: colors.bgBase,
    bgSurface: colors.bgSurface,
    bgSubtle: colors.bgSubtle,
    txPri: colors.txPrimary,
    txSec: colors.txSecondary,
    txTer: colors.txTertiary,
    borderC: colors.lineDefault,
    cardShadow,
  };

  // ── AI 추천 핸들러

  async function handleRecommend() {
    const dest = destination.trim();
    if (!dest) { setAiError(t('explore', 'fillDest')); return; }
    setAiError(''); setResult(null); setLoading(true);
    try {
      let weatherParams: {
        weather_temp_c?: number;
        weather_code?: number;
        rain_chance?: number;
      } = {};
      try {
        const weather = await Promise.race([
          fetchWeather(dest),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('weather_timeout')), 5000)),
        ]);
        weatherParams = {
          weather_temp_c: weather.current.temp_c,
          weather_code:   weather.current.weather_code,
          rain_chance:    weather.forecast[0]?.chance_of_rain,
        };
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[Weather] fetched for', dest, weatherParams);
        }
      } catch {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[Weather] fetch failed or timed out, proceeding without weather data');
        }
      }

      const data = await api.ai.recommend({
        destination: dest, days,
        preferences: preferences.trim() || undefined,
        travel_style: travelStyle || undefined,
        ...weatherParams,
      });
      setResult(data as AiResult);
    } catch (e) {
      let msg: string;
      if (e instanceof AxiosError) {
        if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
          msg = 'AI 일정 생성에 시간이 걸리고 있어요. 잠시 후 다시 시도해 주세요.';
        } else if (e.code === 'ERR_NETWORK' || !e.response) {
          msg = '네트워크 연결이 불안정합니다. Wi-Fi 또는 데이터 상태를 확인 후 다시 시도해 주세요.';
        } else {
          msg = e.response.data?.detail ?? e.response.data?.message ?? t('common', 'network');
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[AI] AxiosError code:', e.code, '| status:', e.response?.status, '| msg:', msg);
        }
      } else {
        msg = e instanceof Error ? e.message : t('common', 'network');
      }
      setAiError(msg);
    } finally { setLoading(false); }
  }

  // ── 날씨로 찾기 핸들러

  async function handleWeatherSearch() {
    if (!weatherCondition) return;
    setWeatherSearching(true); setWeatherSearchError(''); setWeatherDestinations([]);
    try {
      const destinations = await api.ai.byWeather(weatherCondition);
      setWeatherDestinations(destinations);
      if (destinations.length === 0) setWeatherSearchError('추천 여행지를 찾지 못했습니다. 다시 시도해 주세요.');
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? t('common', 'network'))
        : t('common', 'network');
      setWeatherSearchError(msg);
    } finally { setWeatherSearching(false); }
  }

  function handleUseWeatherCity(city: string) {
    setDestination(city);
    setActiveTab('ai');
    setWeatherDestinations([]);
    setWeatherCondition('');
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const trip = await api.trips.create({
        title: result.title,
        destination: destination.trim() || null,
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

  function handleEdit() {
    if (!result) return;
    const planParam = encodeURIComponent(JSON.stringify(result));
    router.push(
      `/ai/builder?plan=${planParam}&destination=${encodeURIComponent(destination.trim())}&days=${days}&preferences=${encodeURIComponent(preferences.trim())}` as never,
    );
  }

  function handleReset() {
    setResult(null);
    setAiError('');
  }

  // ── 내 주변 핸들러

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

  async function handleCatChange(idx: number) {
    setNearbyCat(idx);
    if (userLocation) await loadNearby(idx);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSurface, paddingTop: insets.top }}>

      {/* 헤더 + 탭 */}
      <View style={{ backgroundColor: colors.bgBase, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineDefault }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.txPrimary }}>{t('explore', 'title')}</Text>
        <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>{t('explore', 'subtitle')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}
          contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {[
            { key: 'ai'      as const, label: `✨ ${lang === 'ko' ? 'AI 추천' : 'AI Suggest'}`,    onPress: () => setActiveTab('ai') },
            { key: 'weather' as const, label: `🌤️ ${lang === 'ko' ? '날씨로 찾기' : 'By Weather'}`, onPress: () => setActiveTab('weather') },
            { key: 'nearby'  as const, label: `📍 ${lang === 'ko' ? '내 주변' : 'Nearby'}`,        onPress: handleNearbyTabPress },
          ].map(({ key, label, onPress }) => (
            <TouchableOpacity
              key={key}
              onPress={onPress}
              style={{
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                backgroundColor: activeTab === key ? palette.coral500 : colors.bgSubtle,
              }}
              activeOpacity={0.85}>
              <Text style={{ color: activeTab === key ? '#fff' : colors.txSecondary, fontSize: 14, fontWeight: '700' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeTab === 'ai' && (
        <AiRecommendTab
          theme={theme}
          lang={lang}
          t={t}
          insets={insets}
          destination={destination}
          setDestination={setDestination}
          days={days}
          setDays={setDays}
          preferences={preferences}
          setPreferences={setPreferences}
          travelStyle={travelStyle}
          setTravelStyle={setTravelStyle}
          loading={loading}
          saving={saving}
          result={result}
          aiError={aiError}
          setAiError={setAiError}
          onRecommend={handleRecommend}
          onSave={handleSave}
          onEdit={handleEdit}
          onReset={handleReset}
        />
      )}

      {activeTab === 'weather' && (
        <WeatherTab
          theme={theme}
          lang={lang}
          t={t}
          insets={insets}
          weatherCondition={weatherCondition}
          setWeatherCondition={setWeatherCondition}
          weatherSearching={weatherSearching}
          weatherDestinations={weatherDestinations}
          weatherSearchError={weatherSearchError}
          onWeatherSearch={handleWeatherSearch}
          onSelectCity={handleUseWeatherCity}
        />
      )}

      {activeTab === 'nearby' && (
        <NearbyTab
          theme={theme}
          lang={lang}
          t={t}
          insets={insets}
          nearbyLoading={nearbyLoading}
          nearbyPlaces={nearbyPlaces}
          nearbyCat={nearbyCat}
          nearbyError={nearbyError}
          savingPlaceId={savingPlaceId}
          userLocation={userLocation}
          onCatChange={handleCatChange}
          onRequestLocation={requestLocationAndLoad}
          onRefresh={loadNearby}
          onSavePlace={handleSaveNearby}
        />
      )}
    </View>
  );
}
