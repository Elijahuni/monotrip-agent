/**
 * 날씨 위젯 (U11)
 * - wttr.in 무료 API (인증 키 불필요)
 * - 현재 온도 + 간략 상태 + 3일 예보
 * - 1시간 인메모리 캐시 (컴포넌트 언마운트 시 폐기)
 * - 오프라인 또는 로딩 실패 시 조용히 숨김
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { palette } from '@/lib/design-tokens';
import { fetchWeather, type WeatherData } from '@/lib/weather';

// ─── 인메모리 캐시 (앱 세션 동안 유지) ────────────────────────────────────────

const _cache = new Map<string, WeatherData>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(destination: string): WeatherData | null {
  const entry = _cache.get(destination.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.fetched_at > CACHE_TTL_MS) {
    _cache.delete(destination.toLowerCase());
    return null;
  }
  return entry;
}

// ─── 날짜 포맷 ────────────────────────────────────────────────────────────────

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

// ─── 위젯 ─────────────────────────────────────────────────────────────────────

interface WeatherWidgetProps {
  /** 여행 제목 또는 목적지명 */
  destination: string;
  /** 컴팩트 모드 (헤더 inline) vs 확장 모드 */
  compact?: boolean;
}

export function WeatherWidget({ destination, compact = false }: WeatherWidgetProps) {
  const [data, setData]         = useState<WeatherData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const cached = getCached(destination);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    fetchWeather(destination)
      .then((result) => {
        if (!mounted.current) return;
        _cache.set(destination.toLowerCase(), result);
        setData(result);
      })
      .catch(() => { /* 오프라인 / 404 → 조용히 숨김 */ })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => { mounted.current = false; };
  }, [destination]);

  // 로딩 중 또는 실패 시 렌더 안 함
  if (loading) {
    return (
      <View className="flex-row items-center gap-1.5 px-2 py-1">
        <ActivityIndicator size="small" color={palette.coral300} />
      </View>
    );
  }
  if (!data) return null;

  const { current, forecast } = data;

  // ── 컴팩트 모드 (헤더 인라인) ──────────────────────────────────────────────
  if (compact) {
    return (
      <TouchableOpacity
        className="flex-row items-center gap-1 bg-bg-subtle px-2 py-1 rounded-lg"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}>
        <Text className="text-base">{current.icon}</Text>
        <Text className="text-xs font-semibold text-tx-secondary">{current.temp_c}°</Text>
      </TouchableOpacity>
    );
  }

  // ── 확장 카드 모드 ──────────────────────────────────────────────────────────
  return (
    <View className="bg-bg-card rounded-2xl border border-line-default overflow-hidden mb-3">
      {/* 현재 날씨 헤더 */}
      <TouchableOpacity
        className="flex-row items-center gap-3 px-4 py-3"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}>
        <Text style={{ fontSize: 36 }}>{current.icon}</Text>
        <View className="flex-1">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-3xl font-bold text-tx-primary">{current.temp_c}°</Text>
            <Text className="text-sm text-tx-tertiary">체감 {current.feels_like_c}°</Text>
          </View>
          <Text className="text-xs text-tx-secondary mt-0.5">{current.description}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-xs text-tx-tertiary">💧 {current.humidity}%</Text>
          <Text className="text-xs text-tx-tertiary">💨 {current.wind_kph}km/h</Text>
        </View>
      </TouchableOpacity>

      {/* 3일 예보 (항상 표시) */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        className="border-t border-line-default"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
        {forecast.map((day) => (
          <View key={day.date} className="items-center gap-1 px-3">
            <Text className="text-xs text-tx-tertiary">{shortDate(day.date)}</Text>
            <Text style={{ fontSize: 20 }}>{day.icon}</Text>
            <Text className="text-xs font-semibold text-tx-primary">{day.max_c}°</Text>
            <Text className="text-xs text-tx-tertiary">{day.min_c}°</Text>
            {day.chance_of_rain > 20 && (
              <Text className="text-[10px] text-blue-400">💧{day.chance_of_rain}%</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
