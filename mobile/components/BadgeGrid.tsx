/**
 * BadgeGrid — 획득한 배지 + 잠금 배지를 격자로 표시하는 컴포넌트.
 *
 * 3열 그리드. 획득한 배지는 컬러 이모지 + 이름, 잠금 배지는 회색 처리.
 */
import { ScrollView, Text, View } from 'react-native';

import type { BadgeItem } from '@/lib/types';

interface BadgeGridProps {
  badges: BadgeItem[];       // 획득한 배지
  lockedBadges: BadgeItem[]; // 미획득 배지
  lang: 'ko' | 'en';
}

function BadgeCell({ item, locked, lang }: { item: BadgeItem; locked: boolean; lang: 'ko' | 'en' }) {
  const name = lang === 'ko' ? item.name_ko : item.name_en;

  return (
    <View className="w-[30%] items-center mb-4">
      <View
        className={`w-14 h-14 rounded-2xl items-center justify-center mb-1.5 ${
          locked
            ? 'bg-gray-100 dark:bg-neutral-700'
            : 'bg-blue-50 dark:bg-blue-900/30'
        }`}
      >
        <Text className={`text-2xl ${locked ? 'opacity-30' : ''}`}>
          {item.emoji}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        className={`text-center text-xs leading-tight ${
          locked
            ? 'text-gray-300 dark:text-neutral-600'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {locked ? '???' : name}
      </Text>
      {!locked && item.earned_at && (
        <Text className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          {item.earned_at.slice(0, 10)}
        </Text>
      )}
    </View>
  );
}

export function BadgeGrid({ badges, lockedBadges, lang }: BadgeGridProps) {
  const earnedLabel = lang === 'ko' ? '획득한 배지' : 'Earned Badges';
  const lockedLabel = lang === 'ko' ? '잠금 배지' : 'Locked Badges';
  const allBadges = lang === 'ko' ? '배지 컬렉션' : 'Badge Collection';

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-white dark:bg-neutral-800 p-4 shadow-sm border border-gray-100 dark:border-neutral-700">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-bold text-gray-900 dark:text-white">
          {allBadges}
        </Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {badges.length} / {badges.length + lockedBadges.length}
        </Text>
      </View>

      {/* 획득한 배지 */}
      {badges.length > 0 && (
        <>
          <Text className="text-xs font-semibold text-blue-500 mb-3">
            {earnedLabel} ({badges.length})
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {badges.map((b) => (
              <BadgeCell key={b.badge_id} item={b} locked={false} lang={lang} />
            ))}
          </View>
        </>
      )}

      {/* 잠금 배지 */}
      {lockedBadges.length > 0 && (
        <>
          <Text className="text-xs font-semibold text-gray-300 dark:text-neutral-600 mb-3 mt-2">
            {lockedLabel} ({lockedBadges.length})
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {lockedBadges.map((b) => (
              <BadgeCell key={b.badge_id} item={b} locked lang={lang} />
            ))}
          </View>
        </>
      )}

      {/* 배지가 하나도 없을 때 */}
      {badges.length === 0 && (
        <View className="items-center py-4">
          <Text className="text-3xl mb-2">🏅</Text>
          <Text className="text-sm text-gray-400 dark:text-gray-500">
            {lang === 'ko' ? '아직 획득한 배지가 없어요' : 'No badges yet'}
          </Text>
          <Text className="text-xs text-gray-300 dark:text-neutral-600 mt-1 text-center">
            {lang === 'ko'
              ? '여행을 만들거나 커뮤니티에 글을 올려보세요!'
              : 'Create trips or post in the community!'}
          </Text>
        </View>
      )}
    </View>
  );
}
