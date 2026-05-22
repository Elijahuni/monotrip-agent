import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, shadow, useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import { AiRecommendTab } from '@/components/explore/AiRecommendTab';
import { WeatherTab } from '@/components/explore/WeatherTab';
import { NearbyTab } from '@/components/explore/NearbyTab';
import { useAiRecommend, useNearby, useWeatherSearch } from '@/components/explore/hooks';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { t, isDark, lang } = useSettings();
  const colors = useThemedColors();

  const [activeTab, setActiveTab] = useState<'ai' | 'weather' | 'nearby'>('ai');

  // 탭별 비즈니스 로직은 커스텀 훅으로 분리 (components/explore/hooks.ts)
  const ai = useAiRecommend();
  const weather = useWeatherSearch();
  const nearby = useNearby();

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

  // 날씨 추천 도시를 AI 탭으로 전달 (탭 간 연동 — 화면 레벨에서 처리)
  function handleUseWeatherCity(city: string) {
    ai.setDestination(city);
    setActiveTab('ai');
    weather.reset();
  }

  // 내 주변 탭 첫 진입 시 위치 요청 + 로드
  async function handleNearbyTabPress() {
    setActiveTab('nearby');
    await nearby.ensureLoaded();
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
            { key: 'ai' as const, label: `✨ ${lang === 'ko' ? 'AI 추천' : 'AI Suggest'}`, onPress: () => setActiveTab('ai') },
            { key: 'weather' as const, label: `🌤️ ${lang === 'ko' ? '날씨로 찾기' : 'By Weather'}`, onPress: () => setActiveTab('weather') },
            { key: 'nearby' as const, label: `📍 ${lang === 'ko' ? '내 주변' : 'Nearby'}`, onPress: handleNearbyTabPress },
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
          destination={ai.destination}
          setDestination={ai.setDestination}
          days={ai.days}
          setDays={ai.setDays}
          preferences={ai.preferences}
          setPreferences={ai.setPreferences}
          travelStyle={ai.travelStyle}
          setTravelStyle={ai.setTravelStyle}
          loading={ai.loading}
          saving={ai.saving}
          result={ai.result}
          aiError={ai.aiError}
          setAiError={ai.setAiError}
          onRecommend={ai.handleRecommend}
          onSave={ai.handleSave}
          onEdit={ai.handleEdit}
          onReset={ai.handleReset}
        />
      )}

      {activeTab === 'weather' && (
        <WeatherTab
          theme={theme}
          lang={lang}
          t={t}
          insets={insets}
          weatherCondition={weather.weatherCondition}
          setWeatherCondition={weather.setWeatherCondition}
          weatherSearching={weather.weatherSearching}
          weatherDestinations={weather.weatherDestinations}
          weatherSearchError={weather.weatherSearchError}
          onWeatherSearch={weather.handleWeatherSearch}
          onSelectCity={handleUseWeatherCity}
        />
      )}

      {activeTab === 'nearby' && (
        <NearbyTab
          theme={theme}
          lang={lang}
          t={t}
          insets={insets}
          nearbyLoading={nearby.nearbyLoading}
          nearbyPlaces={nearby.nearbyPlaces}
          nearbyCat={nearby.nearbyCat}
          nearbyError={nearby.nearbyError}
          savingPlaceId={nearby.savingPlaceId}
          userLocation={nearby.userLocation}
          onCatChange={nearby.handleCatChange}
          onRequestLocation={nearby.requestLocationAndLoad}
          onRefresh={nearby.loadNearby}
          onSavePlace={nearby.handleSaveNearby}
        />
      )}
    </View>
  );
}
