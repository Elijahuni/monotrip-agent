import { TouchableOpacity, View, ViewStyle } from 'react-native';

import { shadow as shadowToken } from '@/lib/design-tokens';

export type CardElevation = 'none' | 'sm' | 'md';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  elevation?: CardElevation;
  padding?: CardPadding;
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
  style?: ViewStyle;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

const elevationStyle: Record<CardElevation, ViewStyle> = {
  none: shadowToken.none,
  sm: shadowToken.card,
  md: shadowToken.cardStrong,
};

export function Card({
  children,
  elevation = 'sm',
  padding = 'md',
  onPress,
  onLongPress,
  className = '',
  style,
}: CardProps) {
  const classes = `bg-bg-surface rounded-2xl overflow-hidden ${paddingClasses[padding]} ${className}`;
  const composed = { ...elevationStyle[elevation], ...(style ?? {}) };

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        className={classes}
        style={composed}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={classes} style={composed}>{children}</View>;
}
