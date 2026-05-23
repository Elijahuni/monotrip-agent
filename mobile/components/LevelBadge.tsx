/**
 * LevelBadge — 현재 레벨 + XP 진행 바를 한 눈에 보여주는 카드.
 *
 * Props:
 *   xp            전체 누적 XP
 *   level         레벨 번호 (1~5)
 *   levelTitleKo  한국어 레벨 명칭
 *   levelTitleEn  영어 레벨 명칭
 *   levelEmoji    레벨 이모지
 *   xpCurrent     현재 레벨 내 XP
 *   xpRequired    다음 레벨까지 필요 XP (최고 레벨이면 0)
 *   xpPercentage  0~100
 *   lang          'ko' | 'en'
 */
import { useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface LevelBadgeProps {
  xp: number;
  level: number;
  levelTitleKo: string;
  levelTitleEn: string;
  levelEmoji: string;
  xpCurrent: number;
  xpRequired: number;
  xpPercentage: number;
  lang: 'ko' | 'en';
}

export function LevelBadge({
  xp,
  level,
  levelTitleKo,
  levelTitleEn,
  levelEmoji,
  xpCurrent,
  xpRequired,
  xpPercentage,
  lang,
}: LevelBadgeProps) {
  const title = lang === 'ko' ? levelTitleKo : levelTitleEn;
  const isMax = xpRequired === 0;

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-white dark:bg-neutral-800 p-4 shadow-sm border border-gray-100 dark:border-neutral-700">
      {/* 레벨 헤더 */}
      <View className="flex-row items-center mb-3">
        <View className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 items-center justify-center mr-3">
          <Text className="text-2xl">{levelEmoji}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            Lv.{level}
          </Text>
          <Text className="text-base font-bold text-gray-900 dark:text-white">
            {title}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-gray-400 dark:text-gray-500">총 XP</Text>
          <Text className="text-base font-bold text-blue-500">
            {xp.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* XP 진행 바 */}
      {isMax ? (
        <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
          <Text className="text-xs text-yellow-600 dark:text-yellow-400 text-center font-medium">
            {lang === 'ko' ? '최고 레벨 달성! 👑' : 'Max level reached! 👑'}
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              {lang === 'ko' ? '다음 레벨까지' : 'to next level'}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {xpCurrent.toLocaleString()} / {xpRequired.toLocaleString()} XP
            </Text>
          </View>
          {/* 트랙 */}
          <View className="h-2 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
            <View
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${xpPercentage}%` }}
            />
          </View>
          <Text className="text-right text-xs text-blue-500 mt-1">
            {xpPercentage}%
          </Text>
        </>
      )}
    </View>
  );
}
