/**
 * Explore 화면 비즈니스 로직 훅.
 *
 * explore.tsx가 비대해지지 않도록 탭별 상태/핸들러를 커스텀 훅으로 분리한다.
 *  - useAiRecommend : AI 일정 추천(생성·저장·편집)
 *  - useWeatherSearch : 날씨 기반 여행지 추천
 *  - useNearby : 내 주변 장소 검색·저장
 */
import { AxiosError } from 'axios';
import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { AiResult } from '@/components/explore/AiRecommendTab';
import { api } from '@/lib/api';
import { type NearbyPlace, hasGoogleKey, searchNearbyPlaces } from '@/lib/geocoding';
import { saveTrip } from '@/lib/local-trips';
import { useSettings } from '@/lib/settings-context';
import type { Trip, WeatherDestination } from '@/lib/types';
import { fetchWeather } from '@/lib/weather';

export const NEARBY_CATS = [
  { label: '전체', type: '', emoji: '🗺️' },
  { label: '맛집', type: 'restaurant', emoji: '🍜' },
  { label: '카페', type: 'cafe', emoji: '☕' },
  { label: '관광지', type: 'tourist_attraction', emoji: '🏛️' },
  { label: '쇼핑', type: 'shopping_mall', emoji: '🛍️' },
];

// ── AI 추천 ────────────────────────────────────────────────────────────────────

export function useAiRecommend() {
  const router = useRouter();
  const { t } = useSettings();

  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [preferences, setPreferences] = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [aiError, setAiError] = useState('');

  async function handleRecommend() {
    const dest = destination.trim();
    if (!dest) { setAiError(t('explore', 'fillDest')); return; }
    setAiError(''); setResult(null); setLoading(true);
    try {
      let weatherParams: { weather_temp_c?: number; weather_code?: number; rain_chance?: number } = {};
      try {
        const weather = await Promise.race([
          fetchWeather(dest),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('weather_timeout')), 5000)),
        ]);
        weatherParams = {
          weather_temp_c: weather.current.temp_c,
          weather_code: weather.current.weather_code,
          rain_chance: weather.forecast[0]?.chance_of_rain,
        };
      } catch {
        /* 날씨 실패 시 날씨 없이 진행 */
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
      } else {
        msg = e instanceof Error ? e.message : t('common', 'network');
      }
      setAiError(msg);
    } finally { setLoading(false); }
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
        {
          text: t('explore', 'goTrips'),
          onPress: () => { router.navigate('/(tabs)'); setResult(null); setDestination(''); setPreferences(''); setTravelStyle(''); },
        },
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

  return {
    destination, setDestination, days, setDays, preferences, setPreferences,
    travelStyle, setTravelStyle, loading, saving, result, aiError, setAiError,
    handleRecommend, handleSave, handleEdit, handleReset,
  };
}

// ── 날씨로 찾기 ───────────────────────────────────────────────────────────────

export function useWeatherSearch() {
  const { t } = useSettings();
  const [weatherCondition, setWeatherCondition] = useState('');
  const [weatherSearching, setWeatherSearching] = useState(false);
  const [weatherDestinations, setWeatherDestinations] = useState<WeatherDestination[]>([]);
  const [weatherSearchError, setWeatherSearchError] = useState('');

  async function handleWeatherSearch() {
    if (!weatherCondition) return;
    setWeatherSearching(true); setWeatherSearchError(''); setWeatherDestinations([]);
    try {
      const destinations = await api.ai.byWeather(weatherCondition);
      setWeatherDestinations(destinations);
      if (destinations.length === 0) setWeatherSearchError('추천 여행지를 찾지 못했습니다. 다시 시도해 주세요.');
    } catch (e) {
      const msg = e instanceof AxiosError ? (e.response?.data?.detail ?? t('common', 'network')) : t('common', 'network');
      setWeatherSearchError(msg);
    } finally { setWeatherSearching(false); }
  }

  function reset() {
    setWeatherDestinations([]);
    setWeatherCondition('');
  }

  return {
    weatherCondition, setWeatherCondition, weatherSearching,
    weatherDestinations, weatherSearchError, handleWeatherSearch, reset,
  };
}

// ── 내 주변 ──────────────────────────────────────────────────────────────────

export function useNearby() {
  const { t } = useSettings();
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyCat, setNearbyCat] = useState(0);
  const [nearbyError, setNearbyError] = useState('');
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const didLoadNearby = useRef(false);

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

  /** nearby 탭 첫 진입 시 위치 요청+로드 (1회). */
  async function ensureLoaded() {
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

  return {
    nearbyLoading, nearbyPlaces, nearbyCat, nearbyError, savingPlaceId, userLocation,
    loadNearby, requestLocationAndLoad, ensureLoaded, handleCatChange, handleSaveNearby,
  };
}
