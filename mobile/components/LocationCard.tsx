import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { categoryIcon } from '@/lib/categories';
import { isTicketable, openTicketSearch } from '@/lib/ticket-links';

interface BaseLocation {
  name: string;
  address: string;
  category: string;
  visit_order: number;
  notes: string | null;
}

interface LocationCardProps<T extends BaseLocation> {
  loc: T;
  /** visit_order가 0/누락 시 fallback */
  index: number;
  /** 삭제 핸들러 — 제공 시 우측 ✕ 버튼 표시 */
  onDelete?: (loc: T) => void;
  /** 그룹 내 첫 항목이면 false → 상단 구분선 숨김 */
  showDivider?: boolean;
  /**
   * 여행 목적지명 (예: "도쿄"). 제공 시 관광지·액티비티 카테고리에 🎟️ 티켓 검색 버튼 표시.
   */
  destination?: string;
}

/**
 * 공통 장소 카드.
 * - explore(AI 추천 미리보기): onDelete 없이 사용
 * - 트립 상세(저장된 장소): onDelete 제공
 */
export function LocationCard<T extends BaseLocation>({
  loc,
  index,
  onDelete,
  showDivider = true,
  destination,
}: LocationCardProps<T>) {
  const order = loc.visit_order || index + 1;
  const showTicket = !!destination && isTicketable(loc.category);

  function handleDelete() {
    Alert.alert('장소 삭제', `"${loc.name}"을 삭제하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDelete?.(loc) },
    ]);
  }

  return (
    <View
      className={`flex-row items-start gap-3 py-4 ${
        index > 0 && showDivider ? 'border-t border-line-default' : ''
      }`}>
      {/* 순서 배지 */}
      <View className="w-8 h-8 rounded-full bg-brand-primary items-center justify-center mt-0.5 shrink-0">
        <Text className="text-tx-inverse text-xs font-bold">{order}</Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-1.5 mb-0.5">
          <Text className="text-sm">{categoryIcon(loc.category)}</Text>
          <Text className="text-xs text-tx-tertiary">{loc.category}</Text>
        </View>
        <Text className="text-sm font-bold text-tx-primary">{loc.name}</Text>
        <Text className="text-xs text-tx-tertiary mt-0.5" numberOfLines={1}>
          📍 {loc.address}
        </Text>
        {loc.notes ? (
          <Text className="text-xs text-tx-secondary mt-1 leading-relaxed" numberOfLines={3}>
            {loc.notes}
          </Text>
        ) : null}

        {/* 관광지·액티비티 → 티켓 최저가 검색 */}
        {showTicket ? (
          <TouchableOpacity
            onPress={() => openTicketSearch(loc.name, destination!)}
            activeOpacity={0.75}
            className="flex-row items-center gap-1 mt-2 self-start
                       bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            <Text className="text-xs">🎟️</Text>
            <Text className="text-xs font-semibold text-amber-700">티켓 최저가</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {onDelete ? (
        <TouchableOpacity className="p-1.5 mt-0.5" onPress={handleDelete} activeOpacity={0.7}>
          <Text className="text-tx-tertiary text-base">✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
