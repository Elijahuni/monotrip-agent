import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { palette } from '@/lib/design-tokens';

interface DaySelectorProps {
  value: number;
  onChange: (n: number) => void;
  isDark: boolean;
}

export function DaySelector({ value, onChange, isDark }: DaySelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
      {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity
          key={n}
          style={{
            marginHorizontal: 4, width: 40, height: 40, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: value === n ? palette.coral500 : (isDark ? '#1E1E2E' : '#F0F4F8'),
          }}
          onPress={() => onChange(n)}
          activeOpacity={0.8}>
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: value === n ? '#fff' : (isDark ? '#9BA7B5' : '#5A6474'),
          }}>
            {n}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
