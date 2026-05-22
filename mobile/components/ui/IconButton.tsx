/**
 * IconButton — 접근성 기본을 갖춘 아이콘 전용 버튼.
 *
 * 아이콘만 있는 버튼은 스크린리더가 읽을 텍스트가 없으므로 accessibilityLabel이 필수.
 * 작은 아이콘도 최소 44pt 터치 타겟을 확보하도록 hitSlop을 기본 제공한다.
 */
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, ViewStyle } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';

interface IconButtonProps {
  /** Ionicons 이름 */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** 스크린리더용 라벨 (필수) */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 24,
  color,
  disabled = false,
  style,
}: IconButtonProps) {
  const colors = useThemedColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[{ alignItems: 'center', justifyContent: 'center', minWidth: 40, minHeight: 40 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.txPrimary} />
    </TouchableOpacity>
  );
}
