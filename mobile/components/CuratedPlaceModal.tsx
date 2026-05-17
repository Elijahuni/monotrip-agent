/**
 * 큐레이션 장소 상세 모달.
 * - 큰 커버 이미지 + 메타데이터
 * - "여행에 추가" 버튼 → 사용자 trip 목록에서 선택 후 day 지정
 * - 인스타 해시태그 / 웹사이트 이동
 */
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import type { CuratedPlace, Trip } from '@/lib/types';

interface Props {
  visible: boolean;
  place: CuratedPlace | null;
  onClose: () => void;
  /** 여행에 추가 성공 시 호출 (예: 토스트 + 새로고침) */
  onAdded?: (tripId: number) => void;
}

export function CuratedPlaceModal({ visible, place, onClose, onAdded }: Props) {
  const colors = useThemedColors();
  const { width } = useWindowDimensions();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [similar, setSimilar] = useState<CuratedPlace[]>([]);

  // 모달이 새 장소로 열릴 때마다 상태 초기화 + 유사 장소 로드
  useEffect(() => {
    if (visible) {
      setPickerOpen(false);
      setSelectedTrip(null);
      setSelectedDay(1);
      setErrorMsg(null);
      setSimilar([]);
      if (place?.id) {
        api.places
          .curatedSimilar(place.id, 6)
          .then(setSimilar)
          .catch(() => setSimilar([]));
      }
    }
  }, [visible, place?.id]);

  // 사용자 여행 목록 로드 (피커 열 때 지연 로드)
  const loadTrips = useCallback(async () => {
    if (trips !== null) return;
    try {
      const page = await api.trips.getAll({ limit: 50 });
      setTrips(page.items);
    } catch (e) {
      console.warn('[curated-modal] load trips failed', e);
      setTrips([]);
    }
  }, [trips]);

  const openPicker = () => {
    loadTrips();
    setPickerOpen(true);
  };

  const handleAdd = async () => {
    if (!place || !selectedTrip) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.places.curatedAddToTrip(place.id, {
        trip_id: selectedTrip.id,
        day_index: selectedDay,
        visit_order: 0,
      });
      onAdded?.(selectedTrip.id);
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(err?.response?.data?.message ?? err?.message ?? '추가에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  if (!place) return null;

  // 인스타그램은 비로그인 사용자에게 explore 페이지를 막거나 한글 해시태그가 빈 결과로 보일 수 있어,
  // (1) 앱 deep link 우선 → (2) 웹 폴백 → (3) 그래도 실패하면 Share 시트로 태그 복사 가능하게.
  const openInstagram = async () => {
    if (!place.instagram_hashtag) return;
    const tag = place.instagram_hashtag.replace(/^#/, '').trim();
    const appUrl = Platform.OS === 'ios'
      ? `instagram://tag?name=${encodeURIComponent(tag)}`
      : `intent://tag?name=${encodeURIComponent(tag)}#Intent;scheme=instagram;package=com.instagram.android;end`;
    const webUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;

    try {
      const canApp = await Linking.canOpenURL(appUrl);
      if (canApp) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch { /* fallthrough */ }

    try {
      await Linking.openURL(webUrl);
      Toast.show({
        type: 'info',
        text1: `해시태그: #${tag}`,
        text2: '인스타 로그인 후 다시 검색하면 더 많은 결과를 볼 수 있어요',
        visibilityTime: 3000,
        position: 'bottom',
      });
    } catch {
      // 모든 시도 실패 — 공유 시트로 해시태그 텍스트 제공
      Share.share({ message: `#${tag}` });
    }
  };

  const shareHashtag = async () => {
    if (!place.instagram_hashtag) return;
    const tag = place.instagram_hashtag.replace(/^#/, '').trim();
    await Share.share({ message: `#${tag}` });
  };
  // 지도: 좌표만 검색하면 결과 페이지가 비어 보이므로 **장소 이름 + 좌표**로 보내야 핀이 뜸.
  // iOS: Google Maps 앱 > Apple Maps > 웹, Android: geo: > 웹.
  const openMap = async () => {
    const name = encodeURIComponent(place.name);
    const lat = place.latitude;
    const lng = place.longitude;

    if (Platform.OS === 'ios') {
      const gmapsApp = `comgooglemaps://?q=${name}&center=${lat},${lng}&zoom=16`;
      try {
        if (await Linking.canOpenURL(gmapsApp)) {
          await Linking.openURL(gmapsApp);
          return;
        }
      } catch { /* fall through */ }

      const appleMaps = `maps://?q=${name}&ll=${lat},${lng}`;
      try {
        if (await Linking.canOpenURL(appleMaps)) {
          await Linking.openURL(appleMaps);
          return;
        }
      } catch { /* fall through */ }
    } else {
      // Android: geo: 인텐트가 가장 안정적 — 설치된 지도 앱 중 선택지 제공
      const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${name})`;
      try {
        if (await Linking.canOpenURL(geoUrl)) {
          await Linking.openURL(geoUrl);
          return;
        }
      } catch { /* fall through */ }
    }

    // 웹 폴백 — 이름으로 검색해야 마커/카드가 표시됨
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${name}`);
  };
  const openWebsite = () => {
    if (place.website) Linking.openURL(place.website);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
        {/* 닫기 헤더 */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 4,
          }}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 22, color: colors.txSecondary }}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* 커버 이미지 */}
          {place.cover_image ? (
            <Image
              source={{ uri: place.cover_image }}
              style={{ width, height: width * 0.7, backgroundColor: colors.bgSubtle }}
              contentFit="cover"
              transition={200}
            />
          ) : null}

          <View style={{ padding: 20, gap: 12 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.txPrimary }}>
                {place.name}
              </Text>
              {place.name_en ? (
                <Text style={{ fontSize: 13, color: colors.txTertiary, marginTop: 2 }}>
                  {place.name_en}
                </Text>
              ) : null}
              {place.region ? (
                <Text style={{ fontSize: 13, color: colors.txSecondary, marginTop: 4 }}>
                  📍 {place.region}
                </Text>
              ) : null}
            </View>

            {/* 메트릭 */}
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {place.rating ? (
                <Text style={{ fontSize: 13, color: colors.txSecondary }}>
                  ⭐ {place.rating.toFixed(1)} ({place.review_count.toLocaleString()})
                </Text>
              ) : null}
              {place.price_level ? (
                <Text style={{ fontSize: 13, color: colors.txSecondary }}>
                  {'₩'.repeat(place.price_level)}
                </Text>
              ) : null}
              {place.women_friendly ? (
                <Text style={{ fontSize: 13, color: colors.brandSecondary, fontWeight: '700' }}>
                  👩 여성 친화
                </Text>
              ) : null}
              {place.tax_free ? (
                <Text style={{ fontSize: 13, color: colors.brandPrimary, fontWeight: '700' }}>
                  💸 면세
                </Text>
              ) : null}
            </View>

            {/* vibe 태그 */}
            {place.vibe_tags.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {place.vibe_tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: colors.bgSubtle,
                    }}>
                    <Text style={{ fontSize: 12, color: colors.txSecondary, fontWeight: '600' }}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* 설명 */}
            {place.description ? (
              <Text style={{ fontSize: 14, color: colors.txPrimary, lineHeight: 21 }}>
                {place.description}
              </Text>
            ) : null}

            {/* 주소 */}
            <Text style={{ fontSize: 13, color: colors.txTertiary }}>{place.address}</Text>

            {/* 인스타그램 해시태그 카드 — 발견성 좋게 강조 */}
            {place.instagram_hashtag ? (
              <TouchableOpacity
                onPress={openInstagram}
                onLongPress={shareHashtag}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.lineDefault,
                  backgroundColor: colors.bgSurface,
                }}>
                <Text style={{ fontSize: 22 }}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.txTertiary }}>인스타그램에서 보기</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.txPrimary, marginTop: 2 }}>
                    {place.instagram_hashtag.startsWith('#') ? place.instagram_hashtag : '#' + place.instagram_hashtag}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.txTertiary }}>›</Text>
              </TouchableOpacity>
            ) : null}

            {/* 빠른 액션 버튼 */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <ActionButton label="🗺️ 지도" onPress={openMap} colors={colors} />
              {place.website ? (
                <ActionButton label="🔗 홈페이지" onPress={openWebsite} colors={colors} />
              ) : null}
            </View>

            {/* 비슷한 분위기 (pgvector 의미 유사) */}
            {similar.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.txPrimary, marginBottom: 8 }}>
                  비슷한 분위기
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ gap: 10 }}>
                  {similar.map((s) => (
                    <View key={s.id} style={{ width: 140 }}>
                      {s.cover_image ? (
                        <Image
                          source={{ uri: s.cover_image }}
                          style={{
                            width: 140,
                            height: 100,
                            borderRadius: 10,
                            backgroundColor: colors.bgSubtle,
                          }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 140,
                            height: 100,
                            borderRadius: 10,
                            backgroundColor: colors.bgSubtle,
                          }}
                        />
                      )}
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 12, fontWeight: '700', color: colors.txPrimary, marginTop: 4 }}>
                        {s.name}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.txTertiary }} numberOfLines={1}>
                        {s.region ?? s.city}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* 여행에 추가 영역 */}
            <View
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.lineDefault,
                gap: 12,
              }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.txPrimary }}>
                내 여행에 추가
              </Text>

              {/* 여행 선택 버튼 */}
              <TouchableOpacity
                onPress={openPicker}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.bgBase,
                  borderWidth: 1,
                  borderColor: colors.lineDefault,
                }}>
                <Text style={{ fontSize: 14, color: selectedTrip ? colors.txPrimary : colors.txTertiary }}>
                  {selectedTrip ? selectedTrip.title : '여행을 선택해주세요'}
                </Text>
              </TouchableOpacity>

              {/* day 선택 (1~14) */}
              {selectedTrip ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ gap: 8 }}>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((day) => {
                    const active = day === selectedDay;
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => setSelectedDay(day)}
                        style={{
                          flexShrink: 0,
                          width: 44,
                          height: 36,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          backgroundColor: active ? colors.brandPrimary : colors.bgBase,
                          borderWidth: 1,
                          borderColor: active ? colors.brandPrimary : colors.lineDefault,
                        }}>
                        <Text
                          allowFontScaling={false}
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: active ? '#FFFFFF' : colors.txSecondary,
                          }}>
                          Day {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}

              {errorMsg ? (
                <Text style={{ fontSize: 12, color: colors.txDanger }}>{errorMsg}</Text>
              ) : null}

              <TouchableOpacity
                onPress={handleAdd}
                disabled={!selectedTrip || saving}
                style={{
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: !selectedTrip || saving ? colors.bgStrong : colors.brandPrimary,
                }}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                    여행에 추가
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* 여행 피커 시트 */}
        <Modal
          visible={pickerOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setPickerOpen(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPickerOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={{
                backgroundColor: colors.bgBase,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingVertical: 16,
                maxHeight: '70%',
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: colors.txPrimary,
                  paddingHorizontal: 20,
                  marginBottom: 12,
                }}>
                여행 선택
              </Text>
              <ScrollView>
                {trips === null ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.brandPrimary} />
                  </View>
                ) : trips.length === 0 ? (
                  <Text
                    style={{ padding: 24, textAlign: 'center', color: colors.txTertiary }}>
                    먼저 여행을 만들어주세요
                  </Text>
                ) : (
                  trips.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        setSelectedTrip(t);
                        setSelectedDay(1);
                        setPickerOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.lineDefault,
                      }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.txPrimary }}>
                        {t.title}
                      </Text>
                      {t.destination ? (
                        <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>
                          {t.destination}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

function ActionButton({
  label,
  onPress,
  colors,
}: {
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemedColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.lineDefault,
      }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.txSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}
