import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { palette } from '@/lib/design-tokens';
import { api } from '@/lib/api';
import type { ChecklistItem } from '@/lib/types';

const CHECKLIST_CATS = ['서류', '짐', '예약', '현금'] as const;
const CAT_COLORS: Record<string, string> = {
  '서류': '#4B7BEC', '짐': '#27AE60', '예약': '#F39C12', '현금': '#E74C3C',
};

interface ChecklistSectionProps {
  tripId: number;
  isDark: boolean;
  lang: string;
}

export function ChecklistSection({ tripId, isDark, lang }: ChecklistSectionProps) {
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
    } catch { /* offline */ }
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

const S = StyleSheet.create({
  sectionHdr:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  sectionBody: { marginTop: 2, padding: 14, borderRadius: 14, borderWidth: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  inp:         { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
});
