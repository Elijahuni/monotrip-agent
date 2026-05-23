/**
 * QuickActionBar — 홈 상단 퀵액션 아이콘 바 (트리플 스타일)
 *
 * 항공권 / 숙소 / 투어·티켓 / 쿠폰·혜택 / 렌터카·보험
 * 미구현 항목은 Toast("준비 중이에요") 표시
 */
import { useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

interface QuickAction {
  icon: string;
  labelKey: 'quickFlights' | 'quickHotels' | 'quickTours' | 'quickCoupons' | 'quickRental';
  route?: string;
}

const ACTIONS: QuickAction[] = [
  { icon: '✈️', labelKey: 'quickFlights',  route: '/search/flights' },
  { icon: '🏨', labelKey: 'quickHotels',   route: '/search/hotels'  },
  { icon: '🎟️', labelKey: 'quickTours',    route: '/search/tours'  },
  { icon: '🎁', labelKey: 'quickCoupons',  route: '/coupons'       },
  { icon: '🚗', labelKey: 'quickRental',   route: '/search/rental-cars' },
];

export function QuickActionBar() {
  const router = useRouter();
  const colors = useThemedColors();
  const { t } = useSettings();

  const handlePress = (action: QuickAction) => {
    if (action.route) {
      router.push(action.route as any);
    } else {
      Toast.show({ type: 'info', text1: t('home', 'comingSoon'), visibilityTime: 1800 });
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.labelKey}
          style={styles.item}
          onPress={() => handlePress(action)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.bgBase }]}>
            <Text style={styles.iconEmoji}>{action.icon}</Text>
          </View>
          <Text style={[styles.label, { color: colors.txSecondary }]}>
            {t('home', action.labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  item: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconEmoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
