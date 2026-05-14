import { Text, TouchableOpacity } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** 크기 — sm(높이 28), md(높이 36) */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * 칩 — 카테고리 선택, 일자 선택 등.
 * - selected: 브랜드 색 채움
 * - 미선택: 옅은 배경 + 보조 텍스트
 */
export function Chip({ label, selected = false, onPress, size = 'md', className = '' }: ChipProps) {
  const padY = size === 'sm' ? 'py-1' : 'py-2';
  const padX = size === 'sm' ? 'px-3' : 'px-4';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  const bg = selected ? 'bg-brand-primary' : 'bg-bg-subtle';
  const tx = selected ? 'text-tx-inverse' : 'text-tx-secondary';

  return (
    <TouchableOpacity
      className={`${bg} ${padY} ${padX} rounded-full ${className}`}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}>
      <Text className={`${tx} ${text} font-semibold`}>{label}</Text>
    </TouchableOpacity>
  );
}
