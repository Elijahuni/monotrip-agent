import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, EmptyState, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { categoryIcon } from '@/lib/categories';
import { palette, shadow } from '@/lib/design-tokens';
import { useCreateTrip } from '@/lib/queries';
import type { AiLocationPlan } from '@/lib/schemas';

/**
 * 단일 장소 + UI 상태(선택/Day 배정).
 * Day 0 = 미배정. visit_order는 저장 시 Day 순서로 재계산.
 */
interface BuilderItem {
  loc: AiLocationPlan;
  selected: boolean;
  day: number; // 0 = 미배정, 1..N = Day N
  uid: string; // 안정적인 key
}

function buildItems(locations: AiLocationPlan[], days: number): BuilderItem[] {
  return locations.map((loc, i) => ({
    loc,
    selected: true,
    // 균등 분배: visit_order 또는 인덱스 기준
    day: Math.min(days, Math.floor(i / Math.max(1, Math.ceil(locations.length / days))) + 1),
    uid: `${loc.name}-${i}`,
  }));
}

/**
 * AI 플랜 빌더 화면.
 * Explore 탭에서 추천을 받은 후, 결과를 직렬화해서 query param으로 전달받는다:
 *   /ai/builder?plan=<encoded JSON>&destination=...&days=...&preferences=...
 *
 * 사용자는 장소를 체크박스로 포함/제외, Day 1..N에 배치, 부분 재생성 가능.
 * 최종 저장 시 trip + 선택된 locations를 한 번에 백엔드 POST.
 */
export default function AiBuilderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    plan: string;
    destination: string;
    days: string;
    preferences?: string;
  }>();

  const days = Math.max(1, Number(params.days ?? '3'));
  const destination = params.destination ?? '';
  const preferences = params.preferences ?? '';

  // 초기 plan 파싱
  const initial = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(params.plan ?? '{}')) as {
        title: string;
        description: string;
        locations: AiLocationPlan[];
      };
    } catch {
      return { title: '', description: '', locations: [] as AiLocationPlan[] };
    }
  }, [params.plan]);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [items, setItems] = useState<BuilderItem[]>(() => buildItems(initial.locations, days));

  const [refineOpen, setRefineOpen] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  const createTrip = useCreateTrip();

  const selectedCount = items.filter((i) => i.selected).length;

  function toggleSelect(uid: string) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, selected: !i.selected } : i)));
  }

  function setDay(uid: string, day: number) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, day } : i)));
  }

  // ── Refine ────────────────────────────────────────────────────────────────
  async function handleRefine() {
    const feedback = refineFeedback.trim();
    if (!feedback) return;
    setRefining(true);
    try {
      const kept = items.filter((i) => i.selected).map((i) => i.loc);
      const refined = await api.ai.refine({
        destination,
        days,
        keep_locations: kept,
        feedback,
        target_total: Math.max(kept.length + 2, days * 4),
      });
      // 기존 선택 유지 + 새로 추가된 장소 합치기
      const keptNames = new Set(kept.map((k) => k.name));
      const newOnes = refined.locations.filter((l) => !keptNames.has(l.name));
      setTitle(refined.title || title);
      setDescription(refined.description || description);
      setItems((prev) => {
        // 기존 selected 유지, day 보존
        const keepers = prev.filter((i) => i.selected);
        const additions: BuilderItem[] = newOnes.map((loc, i) => ({
          loc,
          selected: true,
          day: ((keepers.length + i) % days) + 1,
          uid: `${loc.name}-refined-${Date.now()}-${i}`,
        }));
        return [...keepers, ...additions];
      });
      setRefineOpen(false);
      setRefineFeedback('');
    } catch (e) {
      Alert.alert('재생성 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setRefining(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (selectedCount === 0) {
      Alert.alert('알림', '저장할 장소를 1개 이상 선택해주세요.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('알림', '여행 제목을 입력해주세요.');
      return;
    }
    // Day 순서로 정렬 → visit_order 재계산
    const ordered = items
      .filter((i) => i.selected)
      .sort((a, b) => (a.day || 99) - (b.day || 99) || a.loc.visit_order - b.loc.visit_order);

    try {
      await createTrip.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        locations: ordered.map((i, idx) => ({
          name: i.loc.name,
          address: i.loc.address,
          latitude: i.loc.latitude,
          longitude: i.loc.longitude,
          category: i.loc.category,
          visit_order: idx + 1,
          notes: i.loc.notes,
        })),
      });
      Alert.alert('저장 완료 ✈️', '내 여행에 추가되었어요.', [
        {
          text: '내 여행 보기',
          onPress: () => router.navigate('/(tabs)'),
        },
      ]);
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  }

  // ── 일자별 그룹화 ──────────────────────────────────────────────────────────
  const groupedByDay = useMemo(() => {
    const map = new Map<number, BuilderItem[]>();
    for (let d = 0; d <= days; d++) map.set(d, []);
    for (const item of items) {
      const d = Math.min(days, Math.max(0, item.day));
      map.get(d)!.push(item);
    }
    return map;
  }, [items, days]);

  return (
    <View className="flex-1 bg-bg-base" style={{ paddingTop: insets.top }}>
      {/* ── 헤더 ── */}
      <View className="bg-bg-surface px-4 pt-2 pb-3 border-b border-line-default flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-1" activeOpacity={0.7}>
          <Text className="text-tx-brand text-sm font-semibold">← 취소</Text>
        </TouchableOpacity>
        <Text className="text-base font-bold text-tx-primary">일정 편집</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}>
        {/* ── 제목/설명 ── */}
        <View className="mx-4 mt-4">
          <Card padding="lg">
            <TextField
              label="여행 제목"
              value={title}
              onChangeText={setTitle}
              placeholder="예: 도쿄 봄 여행 🌸"
              containerClassName="mb-3"
            />
            <TextField
              label="소개"
              optionalLabel="(선택)"
              value={description}
              onChangeText={setDescription}
              placeholder="여행 컨셉이나 분위기"
              multiline
              numberOfLines={2}
            />
            <View className="mt-3 flex-row items-center gap-2">
              <View className="bg-bg-subtle px-2.5 py-1 rounded-full">
                <Text className="text-xs font-semibold text-tx-secondary">{destination}</Text>
              </View>
              <View className="bg-bg-subtle px-2.5 py-1 rounded-full">
                <Text className="text-xs font-semibold text-tx-secondary">{days}일</Text>
              </View>
              <View className="bg-brand-primary px-2.5 py-1 rounded-full">
                <Text className="text-xs font-bold text-tx-inverse">
                  {selectedCount}개 선택됨
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ── 미배정 ── */}
        {(groupedByDay.get(0)?.length ?? 0) > 0 && (
          <DaySection
            title="미배정"
            subtitle="아래 칩을 눌러 Day에 배치하세요"
            items={groupedByDay.get(0)!}
            days={days}
            onToggle={toggleSelect}
            onSetDay={setDay}
            currentDay={0}
          />
        )}

        {/* ── Day 1..N ── */}
        {Array.from({ length: days }, (_, idx) => idx + 1).map((d) => (
          <DaySection
            key={d}
            title={`Day ${d}`}
            items={groupedByDay.get(d) ?? []}
            days={days}
            onToggle={toggleSelect}
            onSetDay={setDay}
            currentDay={d}
          />
        ))}

        {items.length === 0 && (
          <EmptyState
            icon="✨"
            title="장소가 없어요"
            description="재생성으로 새 추천을 받아보세요"
          />
        )}
      </ScrollView>

      {/* ── 하단 액션 ── */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-bg-surface border-t border-line-default px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row gap-2 mb-2">
          <View className="flex-1">
            <Button
              label="🔄 재생성"
              variant="secondary"
              onPress={() => setRefineOpen(true)}
              size="md"
            />
          </View>
          <View className="flex-[2]">
            <Button
              label={`저장 (${selectedCount}곳)`}
              onPress={handleSave}
              loading={createTrip.isPending}
              disabled={selectedCount === 0}
              size="md"
            />
          </View>
        </View>
      </View>

      {/* ── Refine 모달 ── */}
      <Modal visible={refineOpen} transparent animationType="slide" onRequestClose={() => setRefineOpen(false)}>
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={() => !refining && setRefineOpen(false)}>
          <View
            className="bg-bg-base rounded-t-3xl px-6 pt-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
            onStartShouldSetResponder={() => true}>
            <View className="w-10 h-1 bg-line-strong rounded-full self-center mb-5" />
            <Text className="text-lg font-bold text-tx-primary mb-1">일정 재생성</Text>
            <Text className="text-sm text-tx-tertiary mb-4">
              선택된 {selectedCount}곳을 유지하고 나머지를 새로 받아요
            </Text>
            <TextField
              label="어떻게 바꿔드릴까요?"
              value={refineFeedback}
              onChangeText={setRefineFeedback}
              placeholder="예: 야경 명소, 더 한적한 곳, 맛집 위주"
              multiline
              numberOfLines={2}
              autoFocus
              containerClassName="mb-3"
            />
            <View className="flex-row gap-2 mb-3">
              {['야경 명소', '맛집 위주', '한적한 곳', '가족 친화'].map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  onPress={() => setRefineFeedback(preset)}
                  size="sm"
                />
              ))}
            </View>
            <Button
              label="재생성하기"
              onPress={handleRefine}
              loading={refining}
              disabled={refineFeedback.trim().length === 0}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Day 섹션 ──────────────────────────────────────────────────────────────────

function DaySection({
  title,
  subtitle,
  items,
  days,
  onToggle,
  onSetDay,
  currentDay,
}: {
  title: string;
  subtitle?: string;
  items: BuilderItem[];
  days: number;
  onToggle: (uid: string) => void;
  onSetDay: (uid: string, day: number) => void;
  currentDay: number;
}) {
  if (items.length === 0 && currentDay > 0) {
    // Day는 비어있어도 헤더는 표시 (드래그 인지용)
    return (
      <View className="mx-4 mt-4">
        <Text className="text-sm font-bold text-tx-primary mb-2 px-1">{title}</Text>
        <View className="border border-dashed border-line-strong rounded-xl py-6 items-center">
          <Text className="text-xs text-tx-tertiary">이 날 배치된 장소가 없어요</Text>
        </View>
      </View>
    );
  }
  return (
    <View className="mx-4 mt-4">
      <Text className="text-sm font-bold text-tx-primary mb-1 px-1">{title}</Text>
      {subtitle && <Text className="text-xs text-tx-tertiary mb-2 px-1">{subtitle}</Text>}
      <View className="gap-2">
        {items.map((item) => (
          <BuilderRow
            key={item.uid}
            item={item}
            days={days}
            onToggle={() => onToggle(item.uid)}
            onSetDay={(d) => onSetDay(item.uid, d)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── 단일 장소 카드 ────────────────────────────────────────────────────────────

function BuilderRow({
  item,
  days,
  onToggle,
  onSetDay,
}: {
  item: BuilderItem;
  days: number;
  onToggle: () => void;
  onSetDay: (d: number) => void;
}) {
  const { loc, selected, day } = item;
  return (
    <View className={`rounded-xl ${selected ? 'bg-bg-surface' : 'bg-bg-subtle opacity-60'}`}>
      <View className="flex-row items-center p-3 gap-3">
        {/* 체크박스 */}
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
          <View
            className={`w-6 h-6 rounded-md items-center justify-center ${
              selected ? 'bg-brand-primary' : 'border-2 border-line-strong'
            }`}>
            {selected ? <Text className="text-tx-inverse text-xs font-bold">✓</Text> : null}
          </View>
        </TouchableOpacity>

        {/* 카테고리 아이콘 */}
        <Text className="text-xl">{categoryIcon(loc.category)}</Text>

        {/* 본문 */}
        <View className="flex-1">
          <Text
            className={`text-sm font-bold ${selected ? 'text-tx-primary' : 'text-tx-tertiary'}`}
            numberOfLines={1}>
            {loc.name}
          </Text>
          <Text className="text-xs text-tx-tertiary mt-0.5" numberOfLines={1}>
            {loc.address}
          </Text>
        </View>
      </View>

      {/* Day 선택 칩 (선택된 항목만 보임) */}
      {selected && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-3 pb-3 -mx-1">
          <View className="mx-1">
            <Chip label="미배정" selected={day === 0} onPress={() => onSetDay(0)} size="sm" />
          </View>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <View key={d} className="mx-1">
              <Chip
                label={`Day ${d}`}
                selected={day === d}
                onPress={() => onSetDay(d)}
                size="sm"
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
