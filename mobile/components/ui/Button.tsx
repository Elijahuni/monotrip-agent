import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { palette } from '@/lib/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const variantBg: Record<ButtonVariant, { active: string; disabled: string }> = {
  primary:     { active: 'bg-brand-primary', disabled: 'bg-bg-subtle' },
  secondary:   { active: 'bg-bg-subtle',     disabled: 'bg-bg-subtle' },
  ghost:       { active: 'bg-transparent',   disabled: 'bg-transparent' },
  destructive: { active: 'bg-state-danger',  disabled: 'bg-bg-subtle' },
};

const variantText: Record<ButtonVariant, { active: string; disabled: string }> = {
  primary:     { active: 'text-tx-inverse',  disabled: 'text-tx-disabled' },
  secondary:   { active: 'text-tx-primary',  disabled: 'text-tx-disabled' },
  ghost:       { active: 'text-tx-brand',    disabled: 'text-tx-disabled' },
  destructive: { active: 'text-tx-inverse',  disabled: 'text-tx-disabled' },
};

const sizeClasses: Record<ButtonSize, { padY: string; text: string }> = {
  sm: { padY: 'py-2.5', text: 'text-sm' },
  md: { padY: 'py-3.5', text: 'text-base' },
  lg: { padY: 'py-4',   text: 'text-base' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  leftIcon,
  fullWidth = false,
  className = '',
}: ButtonProps) {
  const isInactive = disabled || loading;
  const bg = isInactive ? variantBg[variant].disabled : variantBg[variant].active;
  const tx = isInactive ? variantText[variant].disabled : variantText[variant].active;
  const { padY, text } = sizeClasses[size];

  const spinnerColor = variant === 'primary' || variant === 'destructive'
    ? palette.white
    : palette.coral500;

  return (
    <TouchableOpacity
      className={`${bg} rounded-xl ${padY} items-center justify-center flex-row gap-2 ${fullWidth ? 'w-full' : ''} ${className}`}
      onPress={onPress}
      disabled={isInactive}
      activeOpacity={0.85}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text className={`${tx} ${text} font-bold`}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
