/**
 * 여행 상세 화면
 * - Day별 일정 (SectionList)
 * - UP-5: 예산 트래커
 * - UP-6: 준비물 체크리스트
 * - UP-7: 공유 링크
 * - 장소 추가/편집/삭제/순서변경
 */

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { palette } from '@/lib/design-tokens';
import { queryKeys } from '@/lib/queries/client';
import { useDeleteLocation, useDeleteTrip, useTrip } from '@/lib/queries';
import { useSettings } from '@/lib/settings-context';
import type { ChecklistItem, Location, Trip } from '@/lib/types';
import type { PlaceSearchResult } from '@/lib/schemas';

// ─── 상수 & 유틸 ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: '관광지',   emoji: '🏛️', key: '관광지' },
  { label: '음식점',   emoji: '🍜', key: '음식점' },
  { label: '숙소',     emoji: '🏨', key: '숙소' },
  { label: '카페',     emoji: '☕', key: '카페' },
  { label: '쇼핑',     emoji: '🛍️', key: '쇼핑' },
  { label: '자연',     emoji: '🌿', key: '자연' },
  { label: '문화',     emoji: '🎭', key: '문화' },
  { label: '액티비티', emoji: '🎢', key: '액티비티' },
];

function categoryEmoji(cat: string) {
  return CATEGORIES.find((c) => c.key === cat)?.emoji ?? '📍';
}

function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (lang === 'ko') return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabel(dayIndex: number, startDate: string | null, lang: string): string {
  const prefix = `Day ${dayIndex}`;
  if (!startDate) return prefix;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex - 1);
  return `${prefix}  ·  ${formatDate(d.toISOString(), lang)}`;
}

function groupByDay(locations: Location[]): Array<{ day: number; locations: Location[] }> {
  const map = new Map<number, Location[]>();
  for (const loc of locations) {
    const day = loc.day_index ?? 1;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(loc);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, locs]) => ({ day, locations: locs.sort((a, b) => a.visit_order - b.visit_order) }));
}

// ─── Day 섹션 헤더 ────────────────────────────────────────────────────────────

function DaySectionHeader({
  day, startDate, locations, isDark, lang,
}: { day: number; startDate: string | null; locations: Location[]; isDark: boolean; lang: string }) {
  const txP  = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc = isDark ? '#9BA7B5' : '#5A6474';
  const bord = isDark ? '#2A2A3E' : '#E8ECF2';
  const bg   = isDark ? '#0D0D18' : '#F7F9FC';
  const totalBudget = locations.reduce((s, l) => s + (l.budget_per_person ?? 0), 0);
  return (
    <View style={[S.dayHdr, { backgroundColor: bg, borderBottomColor: bord }]}>
      <Text style={[S.dayTitle, { color: txP }]}>{dayLabel(day, startDate, lang)}</Text>
      <Text style={[S.daySub, { color: txSc }]}>
        {lang === 'ko'
          ? `장소 ${locations.length}곳${totalBudget > 0 ? ` · ₩${totalBudget.toLocaleString()}` : ''}`
          : `${locations.length} place${locations.length !== 1 ? 's' : ''}${totalBudget > 0 ? ` · ₩${totalBudget.toLocaleString()}` : ''}`}
      </Text>
    </View>
  );
}

// ─── 장소 카드 ────────────────────────────────────────────────────────────────

function RichLocationCard({
  loc, isDark, onDelete, onEdit, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
  loc: Location; isDark: boolean;
  onDelete: () => void; onEdit: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  canMoveUp: boolean; canMoveDown: boolean;
}) {
  const bgS  = isDark ? '#141420' : '#FFFFFF';
  const txP  = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc = isDark ? '#9BA7B5' : '#5A6474';
  const bord = isDark ? '#2A2A3E' : '#E8ECF2';
  const stars = loc.rating
    ? '★'.repeat(Math.round(loc.rating)) + '☆'.repeat(5 - Math.round(loc.rating))
    : null;

  return (
    <View style={[S.locCard, { backgroundColor: bgS, borderColor: bord }]}>
      {/* 순서 배지 + 이동 */}
      <View style={{ alignItems: 'center', gap: 4, marginTop: 2 }}>
        <TouchableOpacity onPress={onMoveUp} disabled={!canMoveUp}
          style={{ opacity: canMoveUp ? 1 : 0.2, padding: 2 }}>
          <Ionicons name="chevron-up" size={14} color={palette.coral500} />
        </TouchableOpacity>
        <View style={S.orderBadge}>
          <Text style={S.orderTx}>{loc.visit_order}</Text>
        </View>
        <TouchableOpacity onPress={onMoveDown} disabled={!canMoveDown}
          style={{ opacity: canMoveDown ? 1 : 0.2, padding: 2 }}>
          <Ionicons name="chevron-down" size={14} color={palette.coral500} />
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 18 }}>{categoryEmoji(loc.category)}</Text>
          <Text style={[S.locName, { color: txP }]} numberOfLines={1}>{loc.name}</Text>
        </View>
        <Text style={[S.locAddr, { color: txSc }]} numberOfLines={1}>{loc.address}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {stars && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#FFF8E1' }]}>
              <Text style={{ color: '#F39C12', fontSize: 11 }}>{stars}</Text>
            </View>
          )}
          {loc.estimated_minutes != null && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#FFF0F0' }]}>
              <Ionicons name="time-outline" size={11} color={palette.coral500} />
              <Text style={{ color: palette.coral500, fontSize: 11, marginLeft: 3 }}>
                {loc.estimated_minutes >= 60
                  ? `${Math.floor(loc.estimated_minutes / 60)}h${loc.estimated_minutes % 60 > 0 ? ` ${loc.estimated_minutes % 60}m` : ''}`
                  : `${loc.estimated_minutes}m`}
              </Text>
            </View>
          )}
          {loc.budget_per_person != null && (
            <View style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#EAFAF1' }]}>
              <Text style={{ color: '#27AE60', fontSize: 11 }}>₩{loc.budget_per_person.toLocaleString()}</Text>
            </View>
          )}
        </View>
        {loc.notes ? (
          <Text style={[S.locNotes, { color: txSc }]} numberOfLines={2}>{loc.notes}</Text>
        ) : null}
      </View>

      {/* 편집 / 삭제 */}
      <View style={{ gap: 8, justifyContent: 'center' }}>
        <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
          <Ionicons name="pencil-outline" size={16} color={palette.coral500} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={16} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── 예산 카드 (UP-5) ─────────────────────────────────────────────────────────

function BudgetCard({
  locations, trip, isDark, lang,
}: { locations: Location[]; trip: Trip | null; isDark: boolean; lang: string }) {
  const totalEstimate = locations.reduce((s, l) => s + (l.budget_per_person ?? 0), 0);
  if (totalEstimate === 0 && !trip?.total_budget) return null;

  const bgS  = isDark ? '#141420' : '#FFFFFF';
  const txP  = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc = isDark ? '#9BA7B5' : '#5A6474';
  const bord = isDark ? '#2A2A3E' : '#E8ECF2';
  const target = trip?.total_budget;
  const pct = target && totalEstimate > 0 ? Math.min((totalEstimate / target) * 100, 100) : 0;
  const byCat: Record<string, number> = {};
  for (const l of locations) {
    if (l.budget_per_person) byCat[l.category] = (byCat[l.category] ?? 0) + l.budget_per_person;
  }

  return (
    <View style={[S.budgetCard, { backgroundColor: bgS, borderColor: bord }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: txP, fontWeight: '700', fontSize: 15 }}>
          {lang === 'ko' ? '💰 예산 요약' : '💰 Budget'}
        </Text>
        <Text style={{ color: palette.coral500, fontWeight: '700', fontSize: 14 }}>
          ₩{totalEstimate.toLocaleString()}
        </Text>
      </View>
      {target != null && (
        <>
          <View style={[S.barBg, { backgroundColor: bord }]}>
            <View style={[S.barFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#E74C3C' : palette.coral500 }]} />
          </View>
          <Text style={{ color: txSc, fontSize: 12, marginTop: 4 }}>
            {lang === 'ko' ? `목표의 ${pct.toFixed(0)}%` : `${pct.toFixed(0)}% of ₩${target.toLocaleString()}`}
          </Text>
        </>
      )}
      {Object.entries(byCat).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {Object.entries(byCat).map(([cat, amt]) => (
            <View key={cat} style={[S.badge, { backgroundColor: isDark ? '#1E1E2E' : '#F0F4FF' }]}>
              <Text style={{ color: txSc, fontSize: 11 }}>{categoryEmoji(cat)} ₩{amt.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── 체크리스트 (UP-6) ────────────────────────────────────────────────────────

const CHECKLIST_CATS = ['서류', '짐', '예약', '현금'] as const;
const CAT_COLORS: Record<string, string> = {
  '서류': '#4B7BEC', '짐': '#27AE60', '예약': '#F39C12', '현금': '#E74C3C',
};

function ChecklistSection({ tripId, isDark, lang }: { tripId: number; isDark: boolean; lang: string }) {
  const [items, setItems]         = useState<ChecklistItem[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [newText, setNewText]     = useState('');
  const [newCat, setNewCat]       = useState<string>('짐');
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [fetched, setFetched]     = useState(false);

  const bgS   = isDark ? '#141420' : '#FFFFFF';
  const bgSub = isDark ? '#1E1E2E' : '#F0F4FF';
  const txP   = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc  = isDark ? '#9BA7B5' : '#5A6474';
  const bord  = isDark ? '#2A2A3E' : '#E8ECF2';

  async function load() {
    if (fetched) return;
    setLoading(true);
    try {
      const data = await api.checklist.getAll(tripId);
      setItems(data);
      setFetched(true);
    } catch { /* 오프라인 */ }
    finally { setLoading(false); }
  }

  function handleToggleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) load();
  }

  async function handleToggleCheck(item: ChecklistItem) {
    const updated = { ...item, is_checked: !item.is_checked };
    setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
    try { await api.checklist.toggle(tripId, item.id, updated.is_checked); }
    catch { setItems((prev) => prev.map((i) => i.id === item.id ? item : i)); }
  }

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const added = await api.checklist.add(tripId, { category: newCat, text: newText.trim() });
      setItems((prev) => [...prev, added]);
      setNewText('');
      setShowInput(false);
    } catch { Alert.alert(lang === 'ko' ? '추가 실패' : 'Failed'); }
    finally { setSaving(false); }
  }

  async function handleDelete(item: ChecklistItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try { await api.checklist.remove(tripId, item.id); }
    catch { setItems((prev) => [...prev, item]); }
  }

  const checkedCount = items.filter((i) => i.is_checked).length;
  const pct = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const byCategory = CHECKLIST_CATS
    .map((cat) => ({ cat, items: items.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 8 }}>
      <TouchableOpacity
        onPress={() => handleToggleOpen(!open)}
        style={[S.sectionHdr, { backgroundColor: bgS, borderColor: bord }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: txP, fontWeight: '700', fontSize: 15 }}>
            ✅ {lang === 'ko' ? '준비물 체크리스트' : 'Pre-trip Checklist'}
          </Text>
          {items.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: bord, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct === 100 ? '#27AE60' : palette.coral500, borderRadius: 2 }} />
              </View>
              <Text style={{ color: txSc, fontSize: 11 }}>{checkedCount}/{items.length}</Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={txSc} />
      </TouchableOpacity>

      {open && (
        <View style={[S.sectionBody, { backgroundColor: bgS, borderColor: bord }]}>
          {loading ? (
            <ActivityIndicator color={palette.coral500} style={{ marginVertical: 12 }} />
          ) : (
            <>
              {byCategory.map(({ cat, items: catItems }) => (
                <View key={cat} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CAT_COLORS[cat] ?? '#9BA7B5' }} />
                    <Text style={{ color: txSc, fontSize: 12, fontWeight: '700' }}>{cat}</Text>
                  </View>
                  {catItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleToggleCheck(item)}
                      onLongPress={() => Alert.alert(item.text, '', [
                        { text: lang === 'ko' ? '삭제' : 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
                      ])}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
                        borderColor: item.is_checked ? '#27AE60' : bord,
                        backgroundColor: item.is_checked ? '#27AE60' : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.is_checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={{
                        color: item.is_checked ? txSc : txP,
                        fontSize: 14,
                        textDecorationLine: item.is_checked ? 'line-through' : 'none',
                        flex: 1,
                      }}>{item.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {showInput ? (
                <View style={{ marginTop: 4 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {CHECKLIST_CATS.map((cat) => (
                        <TouchableOpacity key={cat} onPress={() => setNewCat(cat)}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5,
                            backgroundColor: newCat === cat ? CAT_COLORS[cat] : bgSub,
                            borderColor: newCat === cat ? CAT_COLORS[cat] : bord }}>
                          <Text style={{ color: newCat === cat ? '#fff' : txSc, fontSize: 12, fontWeight: '600' }}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[S.inp, { flex: 1, backgroundColor: bgSub, borderColor: bord, color: txP, marginBottom: 0, paddingVertical: 10 }]}
                      placeholder={lang === 'ko' ? '새 항목 입력' : 'New item'} placeholderTextColor={txSc}
                      value={newText} onChangeText={setNewText}
                      onSubmitEditing={handleAdd} returnKeyType="done" autoFocus />
                    <TouchableOpacity onPress={handleAdd} disabled={saving || !newText.trim()}
                      style={{ backgroundColor: palette.coral500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, opacity: newText.trim() ? 1 : 0.4 }}>
                      {saving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={{ color: '#fff', fontWeight: '700' }}>{lang === 'ko' ? '추가' : 'Add'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowInput(false); setNewText(''); }} style={{ padding: 8 }}>
                      <Ionicons name="close" size={18} color={txSc} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowInput(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 4 }}>
                  <Ionicons name="add-circle-outline" size={18} color={palette.coral500} />
                  <Text style={{ color: palette.coral500, fontSize: 13, fontWeight: '600' }}>
                    {lang === 'ko' ? '항목 추가' : 'Add item'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── 장소 추가/편집 모달 (검색 → 지도 미리보기) ───────────────────────────────

interface LocForm {
  name: string; address: string; latitude: number; longitude: number;
  category: string; day_index: number; notes: string;
  estimated_minutes: string; budget_per_person: string;
}

function AddLocationModal({
  visible, onClose, onSave, onUpdate, totalDays, defaultDay, isDark, lang, initialValues, mode,
}: {
  visible: boolean; onClose: () => void;
  onSave?: (f: LocForm) => Promise<void>;
  onUpdate?: (f: LocForm) => Promise<void>;
  totalDays: number; defaultDay: number; isDark: boolean; lang: string;
  initialValues?: Partial<LocForm>; mode?: 'add' | 'edit';
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState<LocForm>({
    name: '', address: '', latitude: 0, longitude: 0,
    category: '관광지', day_index: defaultDay,
    notes: '', estimated_minutes: '', budget_per_person: '',
  });
  const [saving, setSaving]       = useState(false);
  const [searchQ, setSearchQ]     = useState('');
  const [results, setResults]     = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placeSelected, setPlaceSelected] = useState(false); // 장소 선택 완료 여부
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (isEdit && initialValues) {
      setForm({
        name: initialValues.name ?? '',
        address: initialValues.address ?? '',
        latitude: initialValues.latitude ?? 0,
        longitude: initialValues.longitude ?? 0,
        category: initialValues.category ?? '관광지',
        day_index: initialValues.day_index ?? defaultDay,
        notes: initialValues.notes ?? '',
        estimated_minutes: initialValues.estimated_minutes ?? '',
        budget_per_person: initialValues.budget_per_person ?? '',
      });
      setPlaceSelected((initialValues.latitude ?? 0) !== 0);
      setSearchQ('');
      setResults([]);
    } else {
      setForm({ name: '', address: '', latitude: 0, longitude: 0, category: '관광지', day_index: defaultDay, notes: '', estimated_minutes: '', budget_per_person: '' });
      setPlaceSelected(false);
      setSearchQ('');
      setResults([]);
    }
  }, [visible, defaultDay, isEdit]);

  // 검색어 디바운스
  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 2) { setResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.places.search({ query: searchQ });
        setResults(res);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQ]);

  function selectPlace(p: PlaceSearchResult) {
    setForm((f) => ({
      ...f,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      category: f.category, // 기존 카테고리 유지
    }));
    setPlaceSelected(true);
    setSearchQ('');
    setResults([]);
  }

  function resetPlace() {
    setPlaceSelected(false);
    setForm((f) => ({ ...f, name: '', address: '', latitude: 0, longitude: 0 }));
  }

  function setField<K extends keyof LocForm>(k: K, v: LocForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.name.trim()) { Alert.alert(lang === 'ko' ? '장소를 검색해서 선택해주세요' : 'Search and select a place'); return; }
    setSaving(true);
    try {
      if (isEdit && onUpdate) { await onUpdate(form); }
      else if (onSave) { await onSave(form); }
      onClose();
    } catch { Alert.alert(lang === 'ko' ? '저장 실패' : 'Save failed'); }
    finally { setSaving(false); }
  }

  const bgBase = isDark ? '#0D0D18' : '#FFFFFF';
  const bgSurf = isDark ? '#141420' : '#F7F9FC';
  const txP    = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc   = isDark ? '#9BA7B5' : '#5A6474';
  const bord   = isDark ? '#2A2A3E' : '#E8ECF2';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={S.sheet}>
        <View style={[S.sheetInner, { backgroundColor: bgBase }]}>
          <View style={[S.handle, { backgroundColor: bord }]} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[S.sheetTitle, { color: txP }]}>
              {isEdit ? (lang === 'ko' ? '장소 편집' : 'Edit Place') : (lang === 'ko' ? '장소 추가' : 'Add Place')}
            </Text>

            {/* ── 장소 검색 영역 ── */}
            {!placeSelected ? (
              <>
                <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '장소 검색' : 'Search Place'}</Text>
                <View style={{ position: 'relative', marginBottom: 4 }}>
                  <View style={[S.searchRow, { backgroundColor: bgSurf, borderColor: bord }]}>
                    <Ionicons name="search" size={16} color={txSc} />
                    <TextInput
                      style={[S.searchInp, { color: txP }]}
                      placeholder={lang === 'ko' ? '예: 도쿄 타워, 에펠탑...' : 'e.g. Tokyo Tower, Eiffel Tower...'}
                      placeholderTextColor={txSc}
                      value={searchQ} onChangeText={setSearchQ}
                      returnKeyType="search" autoFocus={!isEdit} />
                    {searching && <ActivityIndicator size="small" color={palette.coral500} />}
                    {searchQ.length > 0 && !searching && (
                      <TouchableOpacity onPress={() => { setSearchQ(''); setResults([]); }}>
                        <Ionicons name="close-circle" size={16} color={txSc} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 검색 결과 드롭다운 */}
                  {results.length > 0 && (
                    <View style={[S.dropdown, { backgroundColor: bgBase, borderColor: bord }]}>
                      {results.map((p) => (
                        <TouchableOpacity
                          key={p.place_id} onPress={() => selectPlace(p)}
                          style={[S.dropItem, { borderBottomColor: bord }]}>
                          <View style={[S.placeIcon, { backgroundColor: palette.coral500 + '20' }]}>
                            <Ionicons name="location" size={14} color={palette.coral500} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: txP, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
                            <Text style={{ color: txSc, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.address}</Text>
                          </View>
                          {p.rating && (
                            <Text style={{ color: '#F39C12', fontSize: 12, fontWeight: '700' }}>★{p.rating.toFixed(1)}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* 검색 없을 때 직접입력 안내 */}
                {results.length === 0 && !searching && searchQ.length === 0 && (
                  <Text style={{ color: txSc, fontSize: 12, marginBottom: 12 }}>
                    {lang === 'ko' ? '장소명을 입력하면 자동으로 주소와 지도를 찾아드려요' : 'Type a place name to auto-fill address & show map'}
                  </Text>
                )}
                {results.length === 0 && !searching && searchQ.length >= 2 && (
                  <TouchableOpacity
                    onPress={() => {
                      setPlaceSelected(true);
                      setForm((f) => ({ ...f, name: searchQ, address: '' }));
                      setSearchQ('');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 6 }}>
                    <Ionicons name="add-circle-outline" size={16} color={palette.coral500} />
                    <Text style={{ color: palette.coral500, fontSize: 13 }}>
                      "{searchQ}" {lang === 'ko' ? '직접 추가' : 'add manually'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              /* ── 선택된 장소 카드 + 지도 미리보기 ── */
              <>
                <View style={[S.selectedCard, { backgroundColor: bgSurf, borderColor: palette.coral500 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: txP, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{form.name}</Text>
                    {form.address ? (
                      <Text style={{ color: txSc, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{form.address}</Text>
                    ) : null}
                    {form.latitude !== 0 && (
                      <Text style={{ color: palette.coral500, fontSize: 11, marginTop: 4 }}>
                        📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={resetPlace} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color={txSc} />
                  </TouchableOpacity>
                </View>

                {/* 지도 미리보기 */}
                {form.latitude !== 0 && form.longitude !== 0 && (
                  <View style={S.mapPreview}>
                    <MapView
                      style={{ flex: 1 }}
                      scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
                      initialRegion={{ latitude: form.latitude, longitude: form.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
                      <Marker coordinate={{ latitude: form.latitude, longitude: form.longitude }} pinColor={palette.coral500} />
                    </MapView>
                  </View>
                )}
              </>
            )}

            {/* ── Day 선택 ── */}
            <Text style={[S.lbl, { color: txSc, marginTop: 4 }]}>{lang === 'ko' ? '방문 일차' : 'Travel Day'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Array.from({ length: totalDays || 1 }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity key={d} onPress={() => setField('day_index', d)}
                    style={[S.chip, {
                      backgroundColor: form.day_index === d ? palette.coral500 : bgSurf,
                      borderColor: form.day_index === d ? palette.coral500 : bord,
                    }]}>
                    <Text style={{ color: form.day_index === d ? '#fff' : txSc, fontWeight: '600', fontSize: 13 }}>Day {d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* ── 카테고리 ── */}
            <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '카테고리' : 'Category'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.key} onPress={() => setField('category', c.key)}
                    style={[S.catChip, {
                      backgroundColor: form.category === c.key ? palette.coral500 : bgSurf,
                      borderColor: form.category === c.key ? palette.coral500 : bord,
                    }]}>
                    <Text>{c.emoji}</Text>
                    <Text style={{ color: form.category === c.key ? '#fff' : txSc, fontSize: 12, marginLeft: 4 }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* ── 소요시간 / 예산 ── */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '소요시간(분)' : 'Est. Minutes'}</Text>
                <TextInput
                  style={[S.inp, { backgroundColor: bgSurf, borderColor: bord, color: txP }]}
                  placeholder="60" placeholderTextColor={txSc} keyboardType="number-pad"
                  value={form.estimated_minutes} onChangeText={(v) => setField('estimated_minutes', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '1인 예산(₩)' : 'Budget/Person'}</Text>
                <TextInput
                  style={[S.inp, { backgroundColor: bgSurf, borderColor: bord, color: txP }]}
                  placeholder="50000" placeholderTextColor={txSc} keyboardType="number-pad"
                  value={form.budget_per_person} onChangeText={(v) => setField('budget_per_person', v)} />
              </View>
            </View>

            {/* ── 메모 ── */}
            <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '메모' : 'Notes'}</Text>
            <TextInput
              style={[S.inp, { backgroundColor: bgSurf, borderColor: bord, color: txP, height: 72, textAlignVertical: 'top' }]}
              placeholder={lang === 'ko' ? '방문 팁, 예약 정보 등' : 'Visit tips, booking info...'} placeholderTextColor={txSc}
              multiline value={form.notes} onChangeText={(v) => setField('notes', v)} />

            <TouchableOpacity onPress={handleSave} disabled={saving} style={[S.saveBtn, { opacity: saving ? 0.7 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={S.saveTx}>
                  {isEdit ? (lang === 'ko' ? '수정 완료' : 'Update') : (lang === 'ko' ? '저장하기' : 'Save')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── 여행 상세 화면 ────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, lang } = useSettings();
  const qc = useQueryClient();

  const tripQuery = useTrip(tripId);
  const deleteTripMut = useDeleteTrip();
  const deleteLocationMut = useDeleteLocation();

  const trip = (tripQuery.data ?? null) as Trip | null;
  const locations = (tripQuery.data?.locations ?? []) as Location[];
  const loading = tripQuery.isPending;

  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [defaultDay, setDefaultDay] = useState(1);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  const bgBase = isDark ? '#0D0D18' : '#F7F9FC';
  const bgSurf = isDark ? '#141420' : '#FFFFFF';
  const txP    = isDark ? '#ECEDEE' : '#1A1A1A';
  const txSc   = isDark ? '#9BA7B5' : '#5A6474';
  const bord   = isDark ? '#2A2A3E' : '#E8ECF2';

  // ── 총 Day 수 ─────────────────────────────────────────────────────────────────

  function totalDays() {
    if (trip?.start_date && trip?.end_date) {
      const diff = Math.ceil(
        (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000,
      ) + 1;
      return Math.max(diff, 1);
    }
    return Math.max(locations.reduce((m, l) => Math.max(m, l.day_index ?? 1), 1), 1);
  }

  // ── 장소 추가 ─────────────────────────────────────────────────────────────────

  async function handleAddLocation(form: LocForm) {
    const dayLocs = locations.filter((l) => (l.day_index ?? 1) === form.day_index);
    const newLoc = await api.locations.create(tripId, {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: form.latitude || 0,
      longitude: form.longitude || 0,
      category: form.category,
      visit_order: dayLocs.length + 1,
      notes: form.notes.trim() || null,
      ...(form.estimated_minutes ? { estimated_minutes: Number(form.estimated_minutes) } : {}),
      ...(form.budget_per_person ? { budget_per_person: Number(form.budget_per_person) } : {}),
      day_index: form.day_index,
    } as Parameters<typeof api.locations.create>[1]);
    qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
      prev ? { ...prev, locations: [...(prev.locations ?? []), newLoc] } : prev,
    );
  }

  // ── 장소 편집 ─────────────────────────────────────────────────────────────────

  async function handleUpdateLocation(form: LocForm) {
    if (!editingLoc) return;
    const updated = await api.locations.update(tripId, editingLoc.id, {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: form.latitude || editingLoc.latitude,
      longitude: form.longitude || editingLoc.longitude,
      category: form.category,
      day_index: form.day_index,
      notes: form.notes.trim() || null,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      budget_per_person: form.budget_per_person ? Number(form.budget_per_person) : null,
    } as Partial<Location>);
    qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
      prev
        ? { ...prev, locations: (prev.locations ?? []).map((l: Location) => l.id === updated.id ? updated : l) }
        : prev,
    );
    setEditingLoc(null);
  }

  // ── 장소 삭제 ─────────────────────────────────────────────────────────────────

  function handleDeleteLocation(loc: Location) {
    Alert.alert(
      lang === 'ko' ? '장소 삭제' : 'Delete Place',
      `"${loc.name}"`,
      [
        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ko' ? '삭제' : 'Delete', style: 'destructive',
          onPress: () => deleteLocationMut.mutate(
            { tripId, locationId: loc.id },
            { onError: () => Alert.alert(lang === 'ko' ? '오류' : 'Error', lang === 'ko' ? '장소 삭제 실패' : 'Failed to delete') },
          ),
        },
      ],
    );
  }

  // ── 순서 변경 ─────────────────────────────────────────────────────────────────

  async function handleMoveLocation(loc: Location, direction: 'up' | 'down') {
    const dayLocs = locations
      .filter((l) => (l.day_index ?? 1) === (loc.day_index ?? 1))
      .sort((a, b) => a.visit_order - b.visit_order);
    const idx = dayLocs.findIndex((l) => l.id === loc.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= dayLocs.length) return;
    const target = dayLocs[swapIdx];
    try {
      const [updA, updB] = await Promise.all([
        api.locations.update(tripId, loc.id, { visit_order: target.visit_order } as Partial<Location>),
        api.locations.update(tripId, target.id, { visit_order: loc.visit_order } as Partial<Location>),
      ]);
      qc.setQueryData(queryKeys.trips.detail(tripId), (prev: typeof tripQuery.data) =>
        prev
          ? {
            ...prev,
            locations: (prev.locations ?? []).map((l: Location) => {
              if (l.id === updA.id) return updA;
              if (l.id === updB.id) return updB;
              return l;
            }),
          }
          : prev,
      );
    } catch { /* 오프라인 시 무시 */ }
  }

  // ── 여행 삭제 ─────────────────────────────────────────────────────────────────

  function handleDeleteTrip() {
    Alert.alert(
      lang === 'ko' ? '여행 삭제' : 'Delete Trip',
      lang === 'ko' ? '모든 장소도 함께 삭제됩니다.' : 'All places will be deleted.',
      [
        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ko' ? '삭제' : 'Delete', style: 'destructive',
          onPress: () => deleteTripMut.mutate(tripId, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  // ── 공유 (UP-7) ──────────────────────────────────────────────────────────────

  async function handleShare() {
    try {
      const { share_url } = await api.trips_share.create(tripId);
      await Share.share({
        message: lang === 'ko'
          ? `여행 일정 공유 🗺️\n${share_url}`
          : `Check out my trip 🗺️\n${share_url}`,
      });
    } catch { Alert.alert(lang === 'ko' ? '공유 실패' : 'Share failed'); }
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  const days = totalDays();
  const groups = groupByDay(locations);
  const filtered = selectedDay === 'all' ? groups : groups.filter((g) => g.day === selectedDay);
  const sections = filtered.map((g) => ({ day: g.day, data: g.locations }));
  const mapLocs = (selectedDay === 'all'
    ? locations
    : locations.filter((l) => (l.day_index ?? 1) === selectedDay)
  ).filter((l) => l.latitude && l.longitude);

  if (loading) {
    return (
      <View style={[S.centered, { backgroundColor: bgBase, paddingTop: insets.top }]}>
        <ActivityIndicator color={palette.coral500} size="large" />
        <Text style={{ color: txSc, fontSize: 14, marginTop: 12 }}>
          {lang === 'ko' ? '여행 정보를 불러오는 중...' : 'Loading trip...'}
        </Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[S.centered, { backgroundColor: bgBase, paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🧭</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: txP, marginBottom: 8 }}>
          {lang === 'ko' ? '여행을 찾을 수 없어요' : 'Trip not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: palette.coral500, borderRadius: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{lang === 'ko' ? '돌아가기' : 'Go back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[S.wrap, { backgroundColor: bgBase }]}>
      {/* ── 헤더 ── */}
      <View style={[S.hdr, { paddingTop: insets.top + 8, backgroundColor: bgSurf, borderBottomColor: bord }]}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={24} color={txP} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[S.hdrTitle, { color: txP }]} numberOfLines={1}>{trip.title}</Text>
          {(trip.start_date || trip.end_date) && (
            <Text style={{ color: txSc, fontSize: 12, marginTop: 2 }}>
              {formatDate(trip.start_date, lang)}{trip.end_date ? ` → ${formatDate(trip.end_date, lang)}` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleShare} style={S.iconBtn}>
          <Ionicons name="share-outline" size={20} color={txP} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteTrip} style={S.iconBtn}>
          <Ionicons name="trash-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={() => (
          <>
            {/* 지도 */}
            {mapLocs.length > 0 && (
              <View style={S.mapWrap}>
                <MapView
                  style={S.map}
                  initialRegion={{
                    latitude: mapLocs[0].latitude,
                    longitude: mapLocs[0].longitude,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }}>
                  {mapLocs.map((loc) => (
                    <Marker
                      key={loc.id}
                      coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                      pinColor={palette.coral500}>
                      <Callout>
                        <View style={{ padding: 4, maxWidth: 180 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13 }}>{loc.name}</Text>
                          <Text style={{ fontSize: 11, color: '#666' }}>
                            {categoryEmoji(loc.category)} Day {loc.day_index} #{loc.visit_order}
                          </Text>
                        </View>
                      </Callout>
                    </Marker>
                  ))}
                </MapView>
                <View style={[S.mapBadge, { backgroundColor: `${palette.coral500}DD` }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>📍 {mapLocs.length}</Text>
                </View>
              </View>
            )}

            {/* Day 탭 */}
            {days > 1 && (
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={[S.dayTabs, { backgroundColor: bgSurf, borderBottomColor: bord }]}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSelectedDay('all')}
                  style={[S.dayTab, { backgroundColor: selectedDay === 'all' ? palette.coral500 : (isDark ? '#1E1E2E' : '#F0F4FF') }]}>
                  <Text style={[S.dayTabTx, { color: selectedDay === 'all' ? '#fff' : txSc }]}>
                    {lang === 'ko' ? '전체' : 'All'}
                  </Text>
                </TouchableOpacity>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity
                    key={d} onPress={() => setSelectedDay(d)}
                    style={[S.dayTab, { backgroundColor: selectedDay === d ? palette.coral500 : (isDark ? '#1E1E2E' : '#F0F4FF') }]}>
                    <Text style={[S.dayTabTx, { color: selectedDay === d ? '#fff' : txSc }]}>Day {d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* 예산 카드 */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <BudgetCard locations={locations} trip={trip} isDark={isDark} lang={lang} />
            </View>

            {/* 체크리스트 */}
            <ChecklistSection tripId={tripId} isDark={isDark} lang={lang} />

            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
              <Text style={{ color: txP, fontSize: 16, fontWeight: '700' }}>
                {lang === 'ko' ? '📍 여행 일정' : '📍 Itinerary'}
              </Text>
            </View>
          </>
        )}
        renderSectionHeader={({ section }) => (
          <DaySectionHeader
            day={section.day}
            startDate={trip.start_date}
            locations={section.data}
            isDark={isDark}
            lang={lang}
          />
        )}
        renderItem={({ item, section }) => {
          const dayLocs = section.data
            .slice()
            .sort((a: Location, b: Location) => a.visit_order - b.visit_order);
          const idx = dayLocs.findIndex((l: Location) => l.id === item.id);
          return (
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              <RichLocationCard
                loc={item} isDark={isDark}
                onDelete={() => handleDeleteLocation(item)}
                onEdit={() => setEditingLoc(item)}
                onMoveUp={() => handleMoveLocation(item, 'up')}
                onMoveDown={() => handleMoveLocation(item, 'down')}
                canMoveUp={idx > 0}
                canMoveDown={idx < dayLocs.length - 1}
              />
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={S.empty}>
            <Text style={{ fontSize: 48 }}>🗺️</Text>
            <Text style={[S.emptyTitle, { color: txP }]}>
              {lang === 'ko' ? '아직 장소가 없어요' : 'No places yet'}
            </Text>
            <Text style={[S.emptyDesc, { color: txSc }]}>
              {lang === 'ko' ? '+ 버튼을 눌러 첫 장소를 추가해보세요' : 'Tap + to add your first place'}
            </Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[S.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => {
          setDefaultDay(selectedDay === 'all' ? 1 : (selectedDay as number));
          setShowAdd(true);
        }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* 장소 추가 모달 */}
      <AddLocationModal
        visible={showAdd} onClose={() => setShowAdd(false)}
        onSave={handleAddLocation} totalDays={days}
        defaultDay={defaultDay} isDark={isDark} lang={lang} mode="add"
      />

      {/* 장소 편집 모달 */}
      <AddLocationModal
        visible={editingLoc !== null}
        onClose={() => setEditingLoc(null)}
        onUpdate={handleUpdateLocation}
        totalDays={days}
        defaultDay={editingLoc?.day_index ?? 1}
        isDark={isDark} lang={lang} mode="edit"
        initialValues={editingLoc ? {
          name: editingLoc.name,
          address: editingLoc.address,
          latitude: editingLoc.latitude,
          longitude: editingLoc.longitude,
          category: editingLoc.category,
          day_index: editingLoc.day_index,
          notes: editingLoc.notes ?? '',
          estimated_minutes: editingLoc.estimated_minutes != null ? String(editingLoc.estimated_minutes) : '',
          budget_per_person: editingLoc.budget_per_person != null ? String(editingLoc.budget_per_person) : '',
        } : undefined}
      />
    </View>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  wrap:       { flex: 1 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hdr:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn:    { width: 36, height: 36, justifyContent: 'center' },
  hdrTitle:   { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, flex: 1 },
  iconBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  mapWrap:    { height: 200, margin: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  map:        { flex: 1 },
  mapBadge:   { position: 'absolute', top: 10, right: 10, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dayTabs:    { flexShrink: 0, borderBottomWidth: 1 },
  dayTab:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginVertical: 8 },
  dayTabTx:   { fontWeight: '600', fontSize: 13 },
  dayHdr:     { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  dayTitle:   { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  daySub:     { fontSize: 12, marginTop: 2 },
  locCard:    { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, alignItems: 'flex-start' },
  orderBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.coral500, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  orderTx:    { color: '#fff', fontWeight: '800', fontSize: 12 },
  locName:    { fontSize: 15, fontWeight: '700', flex: 1 },
  locAddr:    { fontSize: 12, marginTop: 2 },
  locNotes:   { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  badge:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  budgetCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 8 },
  barBg:      { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill:    { height: '100%', borderRadius: 3 },
  sectionHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  sectionBody:{ marginTop: 2, padding: 14, borderRadius: 14, borderWidth: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  empty:      { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyDesc:  { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  fab:        { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: palette.coral500, justifyContent: 'center', alignItems: 'center', shadowColor: palette.coral500, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheetInner: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  lbl:        { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inp:        { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChip:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  saveBtn:    { backgroundColor: palette.coral500, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveTx:     { color: '#fff', fontWeight: '800', fontSize: 16 },
  coordRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: -4 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, gap: 8, marginBottom: 4 },
  searchInp:    { flex: 1, fontSize: 14 },
  dropdown:     { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  dropItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, gap: 10 },
  placeIcon:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  selectedCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10, gap: 8 },
  mapPreview:   { height: 160, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
});
