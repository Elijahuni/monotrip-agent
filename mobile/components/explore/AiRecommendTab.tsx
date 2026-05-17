import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { palette } from '@/lib/design-tokens';
import { openFlightSearch } from '@/lib/flight-links';
import { LocationCard } from '@/components/LocationCard';
import { DaySelector } from './DaySelector';
import type { createTranslator } from '@/lib/i18n';

export interface AiLocation {
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

export interface AiResult {
  title: string;
  description: string;
  locations: AiLocation[];
}

export interface ExploreTheme {
  isDark: boolean;
  bgBase: string;
  bgSurface: string;
  bgSubtle: string;
  txPri: string;
  txSec: string;
  txTer: string;
  borderC: string;
  cardShadow: object;
}

const TRAVEL_STYLES = [
  { key: 'history',  label: '🏛️ 역사/문화', labelEn: '🏛️ History' },
  { key: 'food',     label: '🍜 미식',       labelEn: '🍜 Food' },
  { key: 'shopping', label: '🛍️ 쇼핑',      labelEn: '🛍️ Shopping' },
  { key: 'nature',   label: '🌿 자연',       labelEn: '🌿 Nature' },
  { key: 'activity', label: '🎢 액티비티',   labelEn: '🎢 Activity' },
];

interface AiRecommendTabProps {
  theme: ExploreTheme;
  lang: string;
  t: ReturnType<typeof createTranslator>;
  insets: { bottom: number };
  destination: string;
  setDestination: (v: string) => void;
  days: number;
  setDays: (n: number) => void;
  preferences: string;
  setPreferences: (v: string) => void;
  travelStyle: string;
  setTravelStyle: (v: string) => void;
  loading: boolean;
  saving: boolean;
  result: AiResult | null;
  aiError: string;
  setAiError: (v: string) => void;
  onRecommend: () => void;
  onSave: () => void;
  onEdit: () => void;
  onReset: () => void;
}

export function AiRecommendTab({
  theme, lang, t, insets,
  destination, setDestination, days, setDays, preferences, setPreferences,
  travelStyle, setTravelStyle, loading, saving, result, aiError, setAiError,
  onRecommend, onSave, onEdit, onReset,
}: AiRecommendTabProps) {
  const { isDark, bgBase, bgSurface, bgSubtle, txPri, txSec, txTer, borderC, cardShadow } = theme;
  const canRecommend = destination.trim().length > 0 && !loading;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

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
          <View style={{ marginTop: 12, backgroundColor: isDark ? '#2A0D0D' : '#FFF0F0', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: isDark ? '#5A1A1A' : '#FFDDD9', gap: 8 }}>
            <Text style={{ color: '#E74C3C', fontSize: 13, textAlign: 'center' }}>{aiError}</Text>
            {(aiError.includes('불안정') || aiError.includes('시간이 걸리고')) && (
              <TouchableOpacity
                onPress={onRecommend}
                style={{ marginTop: 4, backgroundColor: '#E74C3C', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>🔄 다시 시도</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={{ marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: canRecommend ? palette.coral500 : bgSubtle }}
          onPress={onRecommend} disabled={!canRecommend} activeOpacity={0.85}>
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

      {loading && (
        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: bgBase, borderRadius: 20, padding: 32, alignItems: 'center', ...cardShadow }}>
          <ActivityIndicator size="large" color={palette.coral500} />
          <Text style={{ color: txPri, fontWeight: '700', fontSize: 15, marginTop: 16 }}>{t('explore', 'recommending')}</Text>
          <Text style={{ color: txTer, fontSize: 13, marginTop: 4, textAlign: 'center' }}>{destination.trim()} {days}{t('explore', 'day')}…</Text>
        </View>
      )}

      {result && !loading && (
        <View style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', ...cardShadow }}>
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

          <View style={{ backgroundColor: bgSurface, paddingHorizontal: 16 }}>
            {result.locations.length > 0 ? (
              result.locations.map((loc, i) => (
                <LocationCard key={`${loc.name}-${i}`} loc={loc} index={i} destination={destination.trim()} />
              ))
            ) : (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ color: txTer, fontSize: 13 }}>{t('explore', 'noResult')}</Text>
              </View>
            )}
          </View>

          <View style={{ backgroundColor: bgBase, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10, borderTopWidth: 1, borderTopColor: borderC }}>
            <TouchableOpacity
              onPress={onEdit}
              style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: palette.coral500 }}
              activeOpacity={0.85}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>✏️ 일정 편집 (선택·배치·재생성)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openFlightSearch(destination.trim())}
              style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                backgroundColor: isDark ? '#0D2040' : '#EBF4FF', borderWidth: 1, borderColor: isDark ? '#1A4070' : '#BAD8F8' }}
              activeOpacity={0.85}>
              <Text style={{ fontSize: 16 }}>✈️</Text>
              <Text style={{ color: isDark ? '#7EC8F8' : '#1A6EBB', fontWeight: '700', fontSize: 14 }}>
                {lang === 'ko' ? '항공권 최저가 검색' : 'Search Cheap Flights'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSave}
              disabled={saving}
              style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: bgSubtle }}
              activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color={txSec} />
                : <Text style={{ color: txSec, fontWeight: '700', fontSize: 14 }}>{t('explore', 'saveTrip')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onReset}
              style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: borderC }}
              activeOpacity={0.85}>
              <Text style={{ color: txSec, fontWeight: '600', fontSize: 14 }}>↩ {lang === 'ko' ? '다시 추천받기' : 'Try Again'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
