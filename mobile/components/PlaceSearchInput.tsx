import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';

import { TextField } from '@/components/ui';
import { palette } from '@/lib/design-tokens';
import { usePlaceSearch } from '@/lib/queries';
import type { PlaceSearchResult } from '@/lib/schemas';

interface PlaceSearchInputProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (place: PlaceSearchResult) => void;
  /** 위치 편향용 (현재 위치 또는 trip 중심 좌표) */
  near?: { latitude: number; longitude: number } | null;
}

/**
 * 디바운스된 장소 검색 + 결과 리스트.
 * 입력은 외부 state로 끌어올렸으므로 상위 컴포넌트가 query를 보존할 수 있다.
 */
export function PlaceSearchInput({
  query,
  onQueryChange,
  onSelect,
  near = null,
}: PlaceSearchInputProps) {
  const search = usePlaceSearch(query, { near });
  const results = search.data ?? [];

  const hint =
    query.trim().length < 2
      ? '2자 이상 입력해주세요'
      : search.isPending && search.isFetching
        ? '검색 중...'
        : !search.isFetching && results.length === 0
          ? '검색 결과가 없어요'
          : undefined;

  return (
    <View className="flex-1">
      <TextField
        placeholder="장소명, 주소, 키워드"
        value={query}
        onChangeText={onQueryChange}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        containerClassName="mb-3"
      />

      {/* 로딩 인디케이터 (덮어쓰기 없이 헤더 영역만) */}
      {query.trim().length >= 2 && search.isFetching && (
        <View className="flex-row items-center gap-2 px-1 mb-2">
          <ActivityIndicator size="small" color={palette.coral500} />
          <Text className="text-xs text-tx-tertiary">검색 중...</Text>
        </View>
      )}

      {/* 결과 리스트 */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.place_id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PlaceRow place={item} onPress={() => onSelect(item)} />}
        ItemSeparatorComponent={() => <View className="h-px bg-line-default ml-16" />}
        ListEmptyComponent={
          hint ? (
            <View className="items-center pt-12 gap-2">
              <Text className="text-3xl">🔎</Text>
              <Text className="text-sm text-tx-tertiary">{hint}</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function PlaceRow({ place, onPress }: { place: PlaceSearchResult; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 py-3 px-1"
      onPress={onPress}
      activeOpacity={0.7}>
      <View className="w-12 h-12 rounded-xl bg-bg-subtle overflow-hidden items-center justify-center">
        {place.photo_url ? (
          <Image source={{ uri: place.photo_url }} className="w-12 h-12" resizeMode="cover" />
        ) : (
          <Text className="text-xl">📍</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-tx-primary" numberOfLines={1}>
          {place.name}
        </Text>
        <Text className="text-xs text-tx-tertiary mt-0.5" numberOfLines={1}>
          {place.address || place.category}
        </Text>
        {place.rating !== null && place.rating !== undefined ? (
          <View className="flex-row items-center gap-1 mt-1">
            <Text className="text-[11px] text-tx-secondary">★ {place.rating.toFixed(1)}</Text>
            {place.user_ratings_total ? (
              <Text className="text-[11px] text-tx-tertiary">
                ({place.user_ratings_total.toLocaleString()})
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View className="bg-bg-subtle px-2 py-1 rounded-md">
        <Text className="text-[10px] font-semibold text-tx-secondary">{place.category}</Text>
      </View>
    </TouchableOpacity>
  );
}
