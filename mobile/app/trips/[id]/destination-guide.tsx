/**
 * 여행지 가이드 화면 (U3)
 * - AI가 생성한 통화·시간대·비자·교통·지역·음식·꿀팁 정보
 * - SQLite에 24시간 캐시
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { getDB } from '@/lib/database';
import { palette } from '@/lib/design-tokens';
import type { DestinationGuide } from '@/lib/types';

// ─── SQLite 캐시 헬퍼 ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedGuide(destination: string): Promise<DestinationGuide | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ data: string; cached_at: string }>(
      'SELECT data, cached_at FROM destination_guides WHERE destination = ?',
      [destination],
    );
    if (!row) return null;
    const age = Date.now() - new Date(row.cached_at).getTime();
    if (age > CACHE_TTL_MS) {
      await db.runAsync('DELETE FROM destination_guides WHERE destination = ?', [destination]);
      return null;
    }
    return JSON.parse(row.data) as DestinationGuide;
  } catch {
    return null;
  }
}

async function setCachedGuide(destination: string, guide: DestinationGuide): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT OR REPLACE INTO destination_guides (destination, data, cached_at)
       VALUES (?, ?, ?)`,
      [destination, JSON.stringify(guide), new Date().toISOString()],
    );
  } catch { /* 캐시 실패는 무시 */ }
}

// ─── 섹션 컴포넌트 ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-bg-card rounded-2xl p-4 mb-3 border border-line-default">
      <Text className="text-xs font-bold text-tx-tertiary uppercase tracking-widest mb-3">
        {title}
      </Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3 mb-2 last:mb-0">
      <Text className="text-base w-6 text-center">{icon}</Text>
      <View className="flex-1">
        <Text className="text-xs text-tx-tertiary mb-0.5">{label}</Text>
        <Text className="text-sm text-tx-primary leading-snug">{value}</Text>
      </View>
    </View>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item, i) => (
        <View key={i} className="bg-bg-subtle px-3 py-1.5 rounded-full">
          <Text className="text-xs text-tx-secondary">{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── 메인 화면 ─────────────────────────────────────────────────────────────────

export default function DestinationGuideScreen() {
  const { id, destination } = useLocalSearchParams<{ id: string; destination: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [guide, setGuide] = useState<DestinationGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dest = destination ?? '';

  const loadGuide = useCallback(async (forceRefresh = false) => {
    if (!dest) {
      setError('여행지 정보가 없습니다.');
      setLoading(false);
      return;
    }

    setError(null);

    if (!forceRefresh) {
      const cached = await getCachedGuide(dest);
      if (cached) {
        setGuide(cached);
        setLoading(false);
        return;
      }
    }

    try {
      const result = await api.ai.destinationGuide(dest);
      setGuide(result);
      await setCachedGuide(dest, result);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : '가이드를 불러오지 못했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dest]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGuide(true);
  }, [loadGuide]);

  // ─── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-bg-base" style={{ paddingTop: insets.top }}>
      {/* 헤더 */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-line-default">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={palette.ink900} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-tx-primary" numberOfLines={1}>
            📖 {dest} 여행 가이드
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} hitSlop={12} disabled={refreshing || loading}>
          <Ionicons
            name="refresh-outline"
            size={20}
            color={refreshing ? palette.coral300 : palette.ink400}
          />
        </TouchableOpacity>
      </View>

      {/* 본문 */}
      {loading ? (
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color={palette.coral500} />
          <Text className="text-sm text-tx-tertiary">AI가 가이드를 작성 중이에요...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Text className="text-4xl">😥</Text>
          <Text className="text-sm text-tx-secondary text-center">{error}</Text>
          <TouchableOpacity
            className="bg-brand-primary px-6 py-3 rounded-xl"
            onPress={() => { setLoading(true); loadGuide(true); }}>
            <Text className="text-white text-sm font-semibold">다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : guide ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.coral500}
            />
          }
          showsVerticalScrollIndicator={false}>

          {/* 히어로 */}
          <View className="bg-brand-primary rounded-2xl p-5 mb-4">
            <Text className="text-2xl font-bold text-white mb-1">{guide.destination}</Text>
            <Text className="text-sm text-white/80">{guide.country}</Text>
          </View>

          {/* 기본 정보 */}
          <SectionCard title="기본 정보">
            <InfoRow icon="💰" label="통화" value={guide.currency} />
            {guide.exchange_rate_krw != null && (
              <InfoRow
                icon="🔄"
                label="환율 (한국 기준)"
                value={`1원 ≈ ${guide.exchange_rate_krw.toFixed(4)} ${guide.currency.split('—')[0].trim()}`}
              />
            )}
            <InfoRow icon="⏰" label="시간대" value={guide.timezone} />
            <InfoRow icon="🗣️" label="주요 언어" value={guide.language} />
            <InfoRow icon="📋" label="비자 (한국인)" value={guide.visa} />
          </SectionCard>

          {/* 날씨 & 시즌 */}
          <SectionCard title="날씨 & 시즌">
            <InfoRow icon="🌤️" label="현재 날씨" value={guide.climate_now} />
            <InfoRow icon="📅" label="최적 여행 시기" value={guide.best_season} />
          </SectionCard>

          {/* 교통 */}
          <SectionCard title="교통">
            <TagList items={guide.transport} />
          </SectionCard>

          {/* 추천 지역 */}
          {guide.top_areas.length > 0 && (
            <SectionCard title="추천 지역">
              {guide.top_areas.map((area, i) => (
                <View key={i} className={i < guide.top_areas.length - 1 ? 'mb-3' : ''}>
                  <View className="flex-row items-center gap-2 mb-0.5">
                    <View className="w-5 h-5 rounded-full bg-brand-primary/20 items-center justify-center">
                      <Text className="text-[10px] font-bold text-brand-primary">{i + 1}</Text>
                    </View>
                    <Text className="text-sm font-semibold text-tx-primary">{area.name}</Text>
                  </View>
                  <Text className="text-xs text-tx-secondary leading-relaxed ml-7">
                    {area.description}
                  </Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* 꼭 먹어야 할 음식 */}
          {guide.must_eat.length > 0 && (
            <SectionCard title="꼭 먹어야 할 음식 🍽️">
              <View className="gap-2">
                {guide.must_eat.map((food, i) => (
                  <View key={i} className="flex-row items-center gap-2">
                    <Text className="text-sm">🍴</Text>
                    <Text className="text-sm text-tx-primary flex-1">{food}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* 꿀팁 */}
          {guide.tips.length > 0 && (
            <SectionCard title="현지 꿀팁 💡">
              <View className="gap-2.5">
                {guide.tips.map((tip, i) => (
                  <View key={i} className="flex-row gap-2">
                    <Text className="text-xs text-tx-tertiary mt-0.5">•</Text>
                    <Text className="text-sm text-tx-primary flex-1 leading-relaxed">{tip}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          <Text className="text-center text-xs text-tx-tertiary mt-2">
            AI가 생성한 정보입니다. 출발 전 공식 채널에서 확인하세요.
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
