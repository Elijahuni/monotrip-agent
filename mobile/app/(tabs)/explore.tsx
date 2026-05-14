import { AxiosError } from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationCard } from '@/components/LocationCard';
import { Button, Card, Chip, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, shadow } from '@/lib/design-tokens';
import { saveTrip } from '@/lib/local-trips';
import type { Trip } from '@/lib/types';

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

// ─── 일수 선택기 ───────────────────────────────────────────────────────────────

function DaySelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
        <View key={n} className="mx-1">
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              value === n ? 'bg-brand-primary' : 'bg-bg-subtle'
            }`}
            onPress={() => onChange(n)}
            activeOpacity={0.8}>
            <Text className={`text-sm font-bold ${value === n ? 'text-tx-inverse' : 'text-tx-secondary'}`}>
              {n}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
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
    if (!dest) { setError('목적지를 입력해주세요.'); return; }
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
      const msg = e instanceof AxiosError
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
      // AI 결과를 trip + locations로 한 번에 저장 (백엔드가 옵션 locations 지원)
      const trip = await api.trips.create({
        title: result.title,
        description: result.description,
        locations: result.locations.map((loc, i) => ({
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          category: loc.category,
          visit_order: loc.visit_order || i + 1,
          notes: loc.notes,
        })),
      });
      await saveTrip(trip as Trip);
      Alert.alert('저장 완료! ✈️', `"${result.title}" 일정이 저장되었습니다.`, [
        {
          text: '내 여행 보기',
          onPress: () => {
            router.navigate('/(tabs)');
            setResult(null); setDestination(''); setPreferences('');
          },
        },
        { text: '계속 탐색', style: 'cancel' },
      ]);
    } catch (e) {
      const msg = e instanceof AxiosError
        ? (e.response?.data?.detail ?? '저장에 실패했습니다.')
        : '네트워크 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setSaving(false);
    }
  }

  /** AI 플랜 빌더로 이동 — 부분 선택/일자별 배치/재생성 가능 */
  function handleEdit() {
    if (!result) return;
    const planParam = encodeURIComponent(JSON.stringify(result));
    router.push(
      `/ai/builder?plan=${planParam}&destination=${encodeURIComponent(destination.trim())}&days=${days}&preferences=${encodeURIComponent(preferences.trim())}` as never,
    );
  }

  const canRecommend = destination.trim().length > 0 && !loading;

  return (
    <View className="flex-1 bg-bg-surface" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-base px-5 pt-4 pb-4 border-b border-line-default">
        <Text className="text-xl font-bold text-tx-primary">AI 추천</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5">
          목적지와 기간을 입력하면 AI가 일정을 만들어드려요
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ── 입력 폼 ── */}
        <View className="mx-4 mt-4">
          <Card padding="lg">
            <TextField
              label="목적지"
              placeholder="예: 도쿄, 파리, 제주도"
              value={destination}
              onChangeText={(t) => { setDestination(t); if (error) setError(''); }}
              autoCapitalize="none"
              returnKeyType="done"
            />

            {/* 여행 일수 */}
            <View className="mt-5 mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-tx-secondary ml-1">여행 일수</Text>
              <Chip label={`${days}일`} selected size="sm" />
            </View>
            <DaySelector value={days} onChange={setDays} />

            {/* 선호도 */}
            <TextField
              label="선호도"
              optionalLabel="(선택)"
              placeholder="예: 맛집 위주, 미술관, 자연 경관"
              value={preferences}
              onChangeText={setPreferences}
              returnKeyType="done"
              containerClassName="mt-5"
            />

            {error ? (
              <View className="mt-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                <Text className="text-state-danger text-sm text-center">{error}</Text>
              </View>
            ) : null}

            <View className="mt-5">
              <Button
                label={loading ? 'AI가 생각하는 중...' : '✨ AI 추천 받기'}
                onPress={handleRecommend}
                loading={loading}
                disabled={!canRecommend}
              />
            </View>
          </Card>
        </View>

        {/* ── 로딩 카드 ── */}
        {loading && (
          <View className="mx-4 mt-4">
            <Card padding="lg">
              <View className="items-center py-4">
                <ActivityIndicator size="large" color={palette.coral500} />
                <Text className="text-tx-primary font-semibold text-base mt-4">AI가 일정을 만들고 있어요</Text>
                <Text className="text-tx-tertiary text-sm mt-1 text-center">
                  {destination.trim()} {days}일 일정을 분석 중...
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* ── 추천 결과 ── */}
        {result && !loading && (
          <View className="mx-4 mt-4 rounded-2xl overflow-hidden" style={shadow.card}>
            {/* 결과 헤더 (브랜드 색 배경) */}
            <View className="bg-brand-primary px-5 pt-5 pb-5">
              <View className="flex-row items-center gap-1.5 mb-2">
                <Text className="text-white text-xs">✨</Text>
                <Text className="text-white/80 text-xs font-semibold">AI 추천 일정</Text>
              </View>
              <Text className="text-tx-inverse text-xl font-bold leading-snug">{result.title}</Text>
              {result.description ? (
                <Text className="text-white/90 text-sm mt-2 leading-relaxed">
                  {result.description}
                </Text>
              ) : null}
              <View className="flex-row items-center gap-2 mt-3">
                <View className="px-2.5 py-1 bg-white/20 rounded-full">
                  <Text className="text-tx-inverse text-xs font-semibold">
                    총 {result.locations.length}개 장소
                  </Text>
                </View>
                <View className="px-2.5 py-1 bg-white/20 rounded-full">
                  <Text className="text-tx-inverse text-xs font-semibold">{days}일 일정</Text>
                </View>
              </View>
            </View>

            {/* 장소 목록 */}
            <View className="bg-bg-surface px-4">
              {result.locations.length > 0 ? (
                result.locations.map((loc, i) => (
                  <LocationCard key={`${loc.name}-${i}`} loc={loc} index={i} />
                ))
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-tx-tertiary text-sm">장소 정보를 불러오지 못했어요</Text>
                </View>
              )}
            </View>

            {/* 액션 버튼 */}
            <View className="bg-bg-surface px-5 pt-4 pb-5 gap-3 border-t border-line-default">
              <Button
                label="✏️ 일정 편집 (선택·배치·재생성)"
                onPress={handleEdit}
              />
              <Button
                label="이대로 바로 저장"
                variant="secondary"
                onPress={handleSave}
                loading={saving}
              />
              <Button
                label="다시 추천받기"
                variant="ghost"
                onPress={() => { setResult(null); setError(''); }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
