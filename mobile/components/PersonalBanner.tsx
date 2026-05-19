/**
 * PersonalBanner — 홈 개인화 배너
 *
 * - 여행 있음: "N일 전 여행이 마지막이에요 / 다음에 이런 여행지 어때요?"
 * - 여행 없음: 첫 여행 CTA 카드
 */
import { useThemedColors } from '@/lib/design-tokens';
import { useTrips } from '@/lib/queries';
import { useSettings } from '@/lib/settings-context';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function daysSince(dateStr: string): number {
  const past = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - past.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function PersonalBanner() {
  const router = useRouter();
  const colors = useThemedColors();
  const { t } = useSettings();
  const tripsQuery = useTrips();

  // 모든 페이지를 단일 배열로 펼치기 (InfiniteQuery)
  const allTrips = useMemo(
    () => tripsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [tripsQuery.data],
  );

  // 마지막 여행의 end_date를 찾는다 (null 제외, 정렬)
  const lastEndDate = allTrips
    .map((tr) => tr.end_date)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  const days = lastEndDate ? daysSince(lastEndDate) : null;

  if (days !== null) {
    // 여행이 있는 배너
    return (
      <View style={[styles.banner, { backgroundColor: colors.brandPrimary + '15' }]}>
        <View style={styles.textBlock}>
          <Text style={[styles.headline, { color: colors.txPrimary }]}>
            <Text style={{ color: colors.brandPrimary, fontWeight: '700' }}>{days}</Text>
            {` ${t('home', 'lastTripAgo')}`}
          </Text>
          <Text style={[styles.sub, { color: colors.txSecondary }]}>
            {t('home', 'nextTrip')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
          onPress={() => router.push('/explore' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>{t('home', 'startAI')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 여행이 없는 CTA 배너
  return (
    <View style={[styles.banner, { backgroundColor: colors.bgBase }]}>
      <View style={styles.textBlock}>
        <Text style={[styles.headline, { color: colors.txPrimary }]}>
          {t('home', 'firstTrip')}
        </Text>
        <Text style={[styles.sub, { color: colors.txSecondary }]}>
          {t('home', 'firstTripSub')}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
        onPress={() => router.push('/explore' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>{t('home', 'startAI')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
  },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    flexShrink: 0,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
