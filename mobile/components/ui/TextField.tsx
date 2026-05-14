import { forwardRef } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

import { placeholderColor } from '@/lib/design-tokens';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  /** 라벨 옆 (선택) 등 보조 텍스트 */
  optionalLabel?: string;
  /** 컨테이너 클래스 */
  containerClassName?: string;
}

/**
 * 라벨 + 입력 + 힌트/에러를 묶은 표준 입력 필드.
 * placeholderTextColor를 토큰에서 자동 적용.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, optionalLabel, containerClassName = '', ...inputProps },
  ref,
) {
  const borderClass = error ? 'border-state-danger' : 'border-line-default';

  return (
    <View className={containerClassName}>
      {label ? (
        <Text className="text-xs font-semibold text-tx-secondary mb-1.5 ml-1">
          {label}
          {optionalLabel ? (
            <Text className="text-tx-tertiary font-normal"> {optionalLabel}</Text>
          ) : null}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        className={`bg-bg-surface border ${borderClass} rounded-xl px-4 py-3.5 text-base text-tx-primary`}
        placeholderTextColor={placeholderColor}
        {...inputProps}
      />
      {error ? (
        <Text className="text-xs text-state-danger mt-1.5 ml-1">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-tx-tertiary mt-1.5 ml-1">{hint}</Text>
      ) : null}
    </View>
  );
});
