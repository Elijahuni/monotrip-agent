/**
 * 온보딩 화면 — 앱 최초 실행 시에만 표시
 * 4개 슬라이드: 여행 계획 / AI 추천 / 지도 / 오프라인
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/lib/settings-context';

const { width: SW } = Dimensions.get('window');

export const ONBOARDING_KEY = '@triple/onboarding_done';

// ─── 슬라이드 데이터 ───────────────────────────────────────────────────────────

interface Slide {
  id: string;
  emoji: string;
  badge: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  accentColor: string;
  bgColor: string;
  darkBg: string;
}

const SLIDES: Slide[] = [
  {
    id: 'plan',
    emoji: '🗺️',
    badge: '여행 계획',
    title: '나만의 여행을\n계획해보세요',
    titleEn: 'Plan Your\nPerfect Trip',
    desc: '모든 여행 정보를 한 곳에서 관리하세요.\n장소, 일정, 메모를 깔끔하게 정리할 수 있어요.',
    descEn: 'Manage all your travel info in one place.\nOrganize places, schedules, and notes.',
    accentColor: '#FF5A5F',
    bgColor: '#FFF0F0',
    darkBg: '#1B0D0D',
  },
  {
    id: 'ai',
    emoji: '✨',
    badge: 'AI 추천',
    title: 'AI가 최적의\n코스를 추천해요',
    titleEn: 'AI Crafts Your\nIdeal Itinerary',
    desc: '목적지와 여행 기간만 입력하면\nAI가 완벽한 여행 코스를 만들어드려요.',
    descEn: 'Just enter a destination and duration,\nand AI builds your perfect itinerary.',
    accentColor: '#9B59B6',
    bgColor: '#F5EEF8',
    darkBg: '#150D1B',
  },
  {
    id: 'map',
    emoji: '📍',
    badge: '스마트 지도',
    title: '지도에서\n위치를 바로 선택',
    titleEn: 'Pick Locations\nRight on the Map',
    desc: '지도를 탭하거나 주소를 검색해서\n여행지를 손쉽게 추가할 수 있어요.',
    descEn: 'Tap the map or search an address\nto add places with ease.',
    accentColor: '#27AE60',
    bgColor: '#EAFAF1',
    darkBg: '#0D1B14',
  },
  {
    id: 'offline',
    emoji: '📱',
    badge: '오프라인 지원',
    title: '인터넷 없이도\n여행 정보 확인',
    titleEn: 'Access Your Plans\nEven Offline',
    desc: '해외에서 데이터가 없어도 걱정 없어요.\n모든 여행 정보가 기기에 저장돼요.',
    descEn: "No data abroad? No problem.\nAll your travel info is saved on device.",
    accentColor: '#E67E22',
    bgColor: '#FEF5E7',
    darkBg: '#1B1408',
  },
];

// ─── 슬라이드 아이템 ────────────────────────────────────────────────────────────

function SlideItem({ slide, isDark, lang }: { slide: Slide; isDark: boolean; lang: string }) {
  const txPri = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSec = isDark ? '#9BA7B5' : '#5A6474';
  const bg    = isDark ? slide.darkBg : slide.bgColor;

  return (
    <View style={{ width: SW, flex: 1 }} className="px-6 justify-center items-center">
      {/* 일러스트 영역 */}
      <View
        style={{
          width: SW * 0.72,
          height: SW * 0.72,
          borderRadius: SW * 0.36,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
          shadowColor: slide.accentColor,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 8,
        }}>
        {/* 배경 장식 원 */}
        <View
          style={{
            position: 'absolute',
            width: SW * 0.48,
            height: SW * 0.48,
            borderRadius: SW * 0.24,
            backgroundColor: slide.accentColor,
            opacity: 0.08,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: SW * 0.35,
            height: SW * 0.35,
            borderRadius: SW * 0.175,
            backgroundColor: slide.accentColor,
            opacity: 0.07,
          }}
        />
        {/* 메인 이모지 */}
        <Text style={{ fontSize: SW * 0.22, lineHeight: SW * 0.28 }}>{slide.emoji}</Text>
        {/* 배지 */}
        <View
          style={{
            position: 'absolute',
            bottom: SW * 0.06,
            right: SW * 0.06,
            backgroundColor: slide.accentColor,
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
          }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{slide.badge}</Text>
        </View>
      </View>

      {/* 텍스트 */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          color: txPri,
          textAlign: 'center',
          lineHeight: 38,
          letterSpacing: -0.5,
          marginBottom: 16,
        }}>
        {lang === 'ko' ? slide.title : slide.titleEn}
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: txSec,
          textAlign: 'center',
          lineHeight: 24,
          paddingHorizontal: 12,
        }}>
        {lang === 'ko' ? slide.desc : slide.descEn}
      </Text>
    </View>
  );
}

// ─── 도트 인디케이터 ────────────────────────────────────────────────────────────

function DotIndicator({ total, current, accentColor }: {
  total: number; current: number; accentColor: string;
}) {
  return (
    <View className="flex-row gap-2 items-center">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? accentColor : '#D0D8E4',
          }}
        />
      ))}
    </View>
  );
}

// ─── 온보딩 메인 ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDark, lang } = useSettings();

  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const isLast = currentIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[currentIndex];

  const bgBase  = isDark ? '#0D0D18' : '#FFFFFF';
  const txPri   = isDark ? '#ECEDEE' : '#1A1A1A';
  const txTer   = isDark ? '#6B7785' : '#9BA7B5';
  const borderC = isDark ? '#2A2A3E' : '#E8ECF2';

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  function goNext() {
    if (isLast) {
      finishOnboarding();
    } else {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  }

  async function finishOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done');
    router.replace('/auth/login');
  }

  return (
    <View style={{ flex: 1, backgroundColor: bgBase, paddingTop: insets.top }}>
      {/* ── 상단: 스킵 버튼 ── */}
      <View className="flex-row justify-between items-center px-6 pt-4 pb-2">
        {/* 앱 로고 */}
        <View className="flex-row items-center gap-2">
          <View
            style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FF5A5F',
              alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>T</Text>
          </View>
          <Text style={{ color: txPri, fontWeight: '700', fontSize: 16 }}>Triple</Text>
        </View>

        {!isLast && (
          <TouchableOpacity onPress={finishOnboarding} activeOpacity={0.7}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: isDark ? '#1E1E2E' : '#F7F9FC' }}>
            <Text style={{ color: txTer, fontSize: 13, fontWeight: '600' }}>
              {lang === 'ko' ? '건너뛰기' : 'Skip'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 슬라이드 ── */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <SlideItem slide={item} isDark={isDark} lang={lang} />
        )}
        style={{ flex: 1 }}
      />

      {/* ── 하단: 도트 + 버튼 ── */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom, 24) + 8,
          borderTopWidth: 1,
          borderTopColor: borderC,
          backgroundColor: bgBase,
          gap: 24,
          alignItems: 'center',
        }}>
        <DotIndicator
          total={SLIDES.length}
          current={currentIndex}
          accentColor={currentSlide.accentColor}
        />

        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={{
            width: '100%',
            paddingVertical: 17,
            borderRadius: 16,
            backgroundColor: currentSlide.accentColor,
            alignItems: 'center',
            shadowColor: currentSlide.accentColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 6,
          }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}>
            {isLast
              ? (lang === 'ko' ? '🚀 시작하기' : '🚀 Get Started')
              : (lang === 'ko' ? '다음으로 →' : 'Next →')
            }
          </Text>
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity onPress={finishOnboarding} activeOpacity={0.7}>
            <Text style={{ color: txTer, fontSize: 13, fontWeight: '500' }}>
              {lang === 'ko' ? '이미 계정이 있어요' : 'I already have an account'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
