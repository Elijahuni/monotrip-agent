import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { palette } from '@/lib/design-tokens';
import { api } from '@/lib/api';
import { CATEGORIES } from '@/lib/trip-utils';
import { PhotoPicker } from '@/components/PhotoPicker';
import type { PlaceSearchResult } from '@/lib/schemas';

export interface LocForm {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  day_index: number;
  notes: string;
  estimated_minutes: string;
  budget_per_person: string;
  images: string[];
}

interface AddLocationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (f: LocForm) => Promise<void>;
  onUpdate?: (f: LocForm) => Promise<void>;
  totalDays: number;
  defaultDay: number;
  isDark: boolean;
  lang: string;
  initialValues?: Partial<LocForm>;
  mode?: 'add' | 'edit';
}

export function AddLocationModal({
  visible, onClose, onSave, onUpdate, totalDays, defaultDay, isDark, lang, initialValues, mode,
}: AddLocationModalProps) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState<LocForm>({
    name: '', address: '', latitude: 0, longitude: 0,
    category: '관광지', day_index: defaultDay,
    notes: '', estimated_minutes: '', budget_per_person: '',
    images: [],
  });
  const [saving, setSaving]       = useState(false);
  const [searchQ, setSearchQ]     = useState('');
  const [results, setResults]     = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [placeSelected, setPlaceSelected] = useState(false);
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
        images: initialValues.images ?? [],
      });
      setPlaceSelected((initialValues.latitude ?? 0) !== 0);
      setSearchQ('');
      setResults([]);
    } else {
      setForm({ name: '', address: '', latitude: 0, longitude: 0, category: '관광지', day_index: defaultDay, notes: '', estimated_minutes: '', budget_per_person: '', images: [] });
      setPlaceSelected(false);
      setSearchQ('');
      setResults([]);
    }
  }, [visible, defaultDay, isEdit]);

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

            {/* 장소 검색 영역 */}
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

            {/* Day 선택 */}
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

            {/* 카테고리 */}
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

            {/* 소요시간 / 예산 */}
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

            {/* 사진 */}
            <Text style={[S.lbl, { color: txSc }]}>{lang === 'ko' ? '사진' : 'Photos'}</Text>
            <View style={{ marginBottom: 12 }}>
              <PhotoPicker
                urls={form.images}
                onChange={(urls) => setField('images', urls)}
                max={5}
                isDark={isDark}
                lang={lang}
              />
            </View>

            {/* 메모 */}
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

const S = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheetInner:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  lbl:          { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inp:          { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChip:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  saveBtn:      { backgroundColor: palette.coral500, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveTx:       { color: '#fff', fontWeight: '800', fontSize: 16 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, gap: 8, marginBottom: 4 },
  searchInp:    { flex: 1, fontSize: 14 },
  dropdown:     { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  dropItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, gap: 10 },
  placeIcon:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  selectedCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10, gap: 8 },
  mapPreview:   { height: 160, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
});
