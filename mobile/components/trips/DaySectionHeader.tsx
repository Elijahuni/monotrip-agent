import { StyleSheet, Text, View } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';
import { dayLabel } from '@/lib/trip-utils';
import type { Location } from '@/lib/types';

interface DaySectionHeaderProps {
  day: number;
  startDate: string | null;
  locations: Location[];
  isDark: boolean;
  lang: string;
}

export function DaySectionHeader({ day, startDate, locations, isDark: _isDark, lang }: DaySectionHeaderProps) {
  const colors = useThemedColors();
  const totalBudget = locations.reduce((s, l) => s + (l.budget_per_person ?? 0), 0);
  return (
    <View style={[S.dayHdr, { backgroundColor: colors.bgBase, borderBottomColor: colors.lineDefault }]}>
      <Text style={[S.dayTitle, { color: colors.txPrimary }]}>{dayLabel(day, startDate, lang)}</Text>
      <Text style={[S.daySub, { color: colors.txSecondary }]}>
        {lang === 'ko'
          ? `장소 ${locations.length}곳${totalBudget > 0 ? ` · ₩${totalBudget.toLocaleString()}` : ''}`
          : `${locations.length} place${locations.length !== 1 ? 's' : ''}${totalBudget > 0 ? ` · ₩${totalBudget.toLocaleString()}` : ''}`}
      </Text>
    </View>
  );
}

const S = StyleSheet.create({
  dayHdr:   { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  dayTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  daySub:   { fontSize: 12, marginTop: 2 },
});
