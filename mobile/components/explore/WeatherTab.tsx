import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { openFlightSearch } from '@/lib/flight-links';
import type { WeatherDestination } from '@/lib/types';
import type { ExploreTheme } from './AiRecommendTab';
import type { createTranslator } from '@/lib/i18n';

const WEATHER_CONDITIONS = [
  { key: 'sunny_warm',  label: '☀️ 맑고 따뜻함',   labelEn: '☀️ Sunny & Warm' },
  { key: 'spring',      label: '🌸 봄날씨',         labelEn: '🌸 Spring' },
  { key: 'snow',        label: '❄️ 설경',           labelEn: '❄️ Snow Scene' },
  { key: 'cool',        label: '🍂 선선함',         labelEn: '🍂 Cool & Mild' },
  { key: 'hot_summer',  label: '🏖️ 뜨거운 여름',   labelEn: '🏖️ Hot Summer' },
];

interface WeatherTabProps {
  theme: ExploreTheme;
  lang: string;
  t: ReturnType<typeof createTranslator>;
  insets: { bottom: number };
  weatherCondition: string;
  setWeatherCondition: (v: string) => void;
  weatherSearching: boolean;
  weatherDestinations: WeatherDestination[];
  weatherSearchError: string;
  onWeatherSearch: () => void;
  onSelectCity: (city: string) => void;
}

export function WeatherTab({
  theme, lang, insets,
  weatherCondition, setWeatherCondition, weatherSearching,
  weatherDestinations, weatherSearchError, onWeatherSearch, onSelectCity,
}: WeatherTabProps) {
  const { bgBase, bgSubtle, txPri, txSec, txTer, borderC, cardShadow } = theme;
  const colors = useThemedColors();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

      <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: bgBase, borderRadius: 20, padding: 20, ...cardShadow }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: txPri, marginBottom: 4 }}>
          {lang === 'ko' ? '🌤️ 원하는 날씨를 선택하세요' : '🌤️ Pick Your Weather'}
        </Text>
        <Text style={{ fontSize: 12, color: txTer, marginBottom: 16 }}>
          {lang === 'ko' ? '지금 그 날씨인 세계 여행지를 AI가 추천해드립니다' : 'AI recommends destinations with that weather right now'}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {WEATHER_CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setWeatherCondition(weatherCondition === c.key ? '' : c.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
                backgroundColor: weatherCondition === c.key ? palette.coral500 : bgSubtle,
                borderColor: weatherCondition === c.key ? palette.coral500 : borderC,
              }}
              activeOpacity={0.8}>
              <Text style={{ color: weatherCondition === c.key ? '#fff' : txSec, fontSize: 14, fontWeight: '600' }}>
                {lang === 'ko' ? c.label : c.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {weatherSearchError ? (
          <View style={{ marginBottom: 12, backgroundColor: colors.warnBg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.warnBorder }}>
            <Text style={{ color: colors.txDanger, fontSize: 13, textAlign: 'center' }}>{weatherSearchError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onWeatherSearch}
          disabled={!weatherCondition || weatherSearching}
          style={{
            borderRadius: 14, paddingVertical: 15, alignItems: 'center',
            backgroundColor: weatherCondition && !weatherSearching ? palette.coral500 : bgSubtle,
          }}
          activeOpacity={0.85}>
          {weatherSearching ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {lang === 'ko' ? '여행지 찾는 중...' : 'Finding destinations...'}
              </Text>
            </View>
          ) : (
            <Text style={{ color: weatherCondition ? '#fff' : txTer, fontWeight: '800', fontSize: 15 }}>
              🌍 {lang === 'ko' ? '날씨 맞는 여행지 찾기' : 'Find by Weather'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {weatherDestinations.length > 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 16, gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: txSec }}>
            {lang === 'ko' ? `🌍 추천 여행지 ${weatherDestinations.length}곳` : `🌍 ${weatherDestinations.length} Destinations`}
          </Text>
          {weatherDestinations.map((dest, idx) => (
            <View key={`${dest.city}-${idx}`} style={{ backgroundColor: bgBase, borderRadius: 20, overflow: 'hidden', ...cardShadow }}>
              <View style={{ backgroundColor: palette.coral500, paddingHorizontal: 20, paddingVertical: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{dest.city}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{dest.country}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{dest.weather_desc}</Text>
                  </View>
                </View>
              </View>

              <View style={{ padding: 16, gap: 12 }}>
                <Text style={{ color: txSec, fontSize: 13, lineHeight: 20 }}>{dest.reason}</Text>

                {dest.sample_locations?.length > 0 && (
                  <View>
                    <Text style={{ color: txTer, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
                      {lang === 'ko' ? '📍 대표 명소' : '📍 Top Spots'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {dest.sample_locations.map((spot, si) => (
                        <View key={si} style={{ backgroundColor: bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ color: txSec, fontSize: 12 }}>{spot}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => onSelectCity(dest.city)}
                    style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: palette.coral500 }}
                    activeOpacity={0.85}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      ✨ {lang === 'ko' ? '이 도시로 일정 만들기' : 'Plan This City'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openFlightSearch(dest.city)}
                    style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                      backgroundColor: colors.accentBg,
                      borderWidth: 1, borderColor: colors.accentText }}
                    activeOpacity={0.85}>
                    <Text style={{ color: colors.accentText, fontWeight: '700', fontSize: 13 }}>
                      ✈️ {lang === 'ko' ? '항공권 검색' : 'Flights'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
