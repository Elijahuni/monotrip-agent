import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { saveTrip } from '@/lib/local-trips';
import type { Trip } from '@/lib/types';

// ─── 로컬 타입 ─────────────────────────────────────────────────────────────────
// 백엔드 AiLocationPlan과 1:1 대응 (id/trip_id/created_at 없음)

interface AiLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  visit_order: number;
  notes: string | null;
}

interface AiResult {
  title: string;
  description: string;
  locations: AiLocation[];
}

// ─── 카테고리 아이콘 ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  숙소: '🏨',
  음식점: '🍜',
  관광지: '🗺️',
  카페: '☕',
  쇼핑: '🛍️',
  자연: '🌿',
  문화: '🏛️',
  엔터테인먼트: '🎭',
};

function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📍';
}

// ─── 일수 선택기 ────────────────────────────────────────────────────────────────

interface DaySelectorProps {
  value: number;
  onChange: (n: number) => void;
}

function DaySelector({ value, onChange }: DaySelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity
          key={n}
          className={`mx-1 w-10 h-10 rounded-full items-center justify-center ${
            value === n ? 'bg-blue-500' : 'bg-gray-100'
          }`}
          onPress={() => onChange(n)}
          activeOpacity={0.8}>
          <Text
            className={`text-sm font-semibold ${value === n ? 'text-white' : 'text-gray-600'}`}>
            {n}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── 장소 카드 ─────────────────────────────────────────────────────────────────

function LocationCard({ loc, index }: { loc: AiLocation; index: number }) {
  return (
    <View
      className={`flex-row items-start gap-3 py-4 ${
        index > 0 ? 'border-t border-gray-100' : ''
      }`}>
      {/* 순서 배지 */}
      <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center mt-0.5 shrink-0">
        <Text className="text-white text-xs font-bold">{loc.visit_order}</Text>
      </View>

      <View className="flex-1">
        {/* 카테고리 */}
        <View className="flex-row items-center gap-1.5 mb-0.5">
          <Text className="text-sm">{categoryIcon(loc.category)}</Text>
          <Text className="text-xs text-gray-400">{loc.category}</Text>
        </View>
        {/* 장소명 */}
        <Text className="text-sm font-bold text-gray-900">{loc.name}</Text>
        {/* 주소 */}
        <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
          📍 {loc.address}
        </Text>
        {/* 메모 */}
        {loc.notes ? (
          <Text className="text-xs text-gray-500 mt-1 italic" numberOfLines={3}>
            {loc.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── 로딩 카드 ─────────────────────────────────────────────────────────────────

function LoadingCard({ destination, days }: { destination: string; days: number }) {
  return (
    <View className="mx-4 mt-4 bg-white rounded-2xl p-8 items-center border border-gray-100">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="text-gray-800 font-semibold text-base mt-4">AI가 일정을 만들고 있어요</Text>
      <Text className="text-gray-400 text-sm mt-1 text-center">
        {destination} {days}일 일정을 분석 중...
      </Text>
    </View>
  );
}

// ─── AI 추천 화면 ───────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [destination, setDestination] = useState('');
  const [days, setDays] = useState(3);
  const [preferences, setPreferences] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState('');

  async function handleRecommend() {
    const dest = destination.trim();
    if (!dest) {
      setError('목적지를 입력해주세요.');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.ai.recommend({
        destination: dest,
        days,
        preferences: preferences.trim() || undefined,
      });
      setResult(data as AiResult);
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? 'AI 추천에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      const trip = await api.trips.create({
        title: result.title,
        description: result.description,
      });
      await saveTrip(trip as Trip);
      Alert.alert('저장 완료! ✈️', `"${result.title}" 일정이 저장되었습니다.`, [
        {
          text: '내 여행 보기',
          onPress: () => {
            router.navigate('/(tabs)');
            setResult(null);
            setDestination('');
            setPreferences('');
          },
        },
        { text: '계속 탐색', style: 'cancel' },
      ]);
    } catch (e) {
      const msg =
        e instanceof AxiosError
          ? (e.response?.data?.detail ?? '저장에 실패했습니다.')
          : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setSaving(false);
    }
  }

  const canRecommend = destination.trim().length > 0 && !loading;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">AI 여행 추천</Text>
        <Text className="text-sm text-gray-400 mt-1">
          목적지와 기간을 입력하면 AI가 일정을 만들어드려요
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ── 입력 폼 ── */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-5 border border-gray-100">
          {/* 목적지 */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">목적지</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            placeholder="예: 도쿄, 파리, 제주도"
            placeholderTextColor="#9ca3af"
            value={destination}
            onChangeText={(t) => {
              setDestination(t);
              if (error) setError('');
            }}
            autoCapitalize="none"
            returnKeyType="done"
          />

          {/* 여행 일수 */}
          <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            여행 일수{' '}
            <Text className="text-blue-500 font-bold">{days}일</Text>
          </Text>
          <DaySelector value={days} onChange={setDays} />

          {/* 선호도 (선택) */}
          <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">
            선호도{' '}
            <Text className="text-xs text-gray-400 font-normal">(선택)</Text>
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
            placeholder="예: 맛집 위주, 미술관, 자연 경관"
            placeholderTextColor="#9ca3af"
            value={preferences}
            onChangeText={setPreferences}
            returnKeyType="done"
          />

          {/* 에러 */}
          {error ? (
            <Text className="text-red-500 text-sm mt-3 text-center">{error}</Text>
          ) : null}

          {/* 추천 버튼 */}
          <TouchableOpacity
            className={`mt-4 rounded-xl py-4 items-center ${
              canRecommend ? 'bg-blue-500' : 'bg-gray-100'
            }`}
            onPress={handleRecommend}
            disabled={!canRecommend}
            activeOpacity={0.85}>
            {loading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#fff" size="small" />
                <Text className="text-white font-semibold">AI가 생각하는 중...</Text>
              </View>
            ) : (
              <Text
                className={`font-bold text-base ${canRecommend ? 'text-white' : 'text-gray-400'}`}>
                ✨ AI 추천 받기
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 로딩 카드 ── */}
        {loading && (
          <LoadingCard destination={destination.trim()} days={days} />
        )}

        {/* ── 추천 결과 ── */}
        {result && !loading && (
          <View className="mx-4 mt-4">
            {/* 결과 헤더 */}
            <View className="bg-blue-500 rounded-t-2xl px-5 pt-5 pb-5">
              <Text className="text-blue-100 text-xs font-semibold mb-1.5">✨ AI 추천 일정</Text>
              <Text className="text-white text-xl font-bold leading-snug">{result.title}</Text>
              {result.description ? (
                <Text className="text-blue-100 text-sm mt-2 leading-relaxed">
                  {result.description}
                </Text>
              ) : null}
              <View className="flex-row items-center gap-1 mt-3">
                <View className="px-2.5 py-1 bg-blue-400 rounded-full">
                  <Text className="text-white text-xs font-semibold">
                    총 {result.locations.length}개 장소
                  </Text>
                </View>
                <View className="px-2.5 py-1 bg-blue-400 rounded-full">
                  <Text className="text-white text-xs font-semibold">{days}일 일정</Text>
                </View>
              </View>
            </View>

            {/* 장소 목록 */}
            <View className="bg-white border-x border-gray-100 px-4">
              {result.locations.length > 0 ? (
                result.locations.map((loc, i) => (
                  <LocationCard key={`${loc.name}-${i}`} loc={loc} index={i} />
                ))
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-gray-400 text-sm">장소 정보를 불러오지 못했어요</Text>
                </View>
              )}
            </View>

            {/* 액션 버튼 */}
            <View className="bg-white rounded-b-2xl border border-t-0 border-gray-100 px-5 pt-4 pb-5 gap-3">
              <TouchableOpacity
                className={`rounded-xl py-4 items-center ${saving ? 'bg-gray-100' : 'bg-blue-500'}`}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator color="#6b7280" />
                ) : (
                  <Text className="text-white font-bold text-base">이 일정으로 저장</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="rounded-xl py-4 items-center bg-gray-50 border border-gray-200"
                onPress={() => {
                  setResult(null);
                  setError('');
                }}
                activeOpacity={0.85}>
                <Text className="text-gray-600 font-semibold text-base">다시 추천받기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
