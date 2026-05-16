import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { palette } from '@/lib/design-tokens';
import { categoryEmoji } from '@/lib/trip-utils';
import type { Location, Trip } from '@/lib/types';

interface BudgetCardProps {
  locations: Location[];
  trip: Trip | null;
  isDark: boolean;
  lang: string;
  onUpdateBudget?: (budget: number | null) => Promise<void>;
}

export function BudgetCard({ locations, trip, isDark, lang, onUpdateBudget }: BudgetCardProps) {
  const totalEstimate = locations.reduce((s, l) => s + (l.budget_per_person ?? 0), 0);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(trip?.total_budget ? String(trip.total_budget) : '');
  const [saving, setSaving] = useState(false);

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

  async function saveTarget() {
    if (!onUpdateBudget) return;
    setSaving(true);
    const num = inputVal.trim() ? Number(inputVal.replace(/,/g, '')) : null;
    try {
      await onUpdateBudget(isNaN(num as number) ? null : num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[S.budgetCard, { backgroundColor: bgS, borderColor: bord }]}>
      {/* 헤더 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: txP, fontWeight: '700', fontSize: 15 }}>
          {lang === 'ko' ? '💰 예산 요약' : '💰 Budget'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: palette.coral500, fontWeight: '700', fontSize: 14 }}>
            ₩{totalEstimate.toLocaleString()}
          </Text>
          {onUpdateBudget && (
            <TouchableOpacity onPress={() => { setEditing(true); setInputVal(target ? String(target) : ''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: txSc, fontSize: 12 }}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 목표 예산 편집 */}
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TextInput
            style={{ flex: 1, borderWidth: 1, borderColor: palette.coral500, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: txP, fontSize: 14 }}
            value={inputVal}
            onChangeText={setInputVal}
            keyboardType="numeric"
            placeholder={lang === 'ko' ? '목표 예산 (원)' : 'Target budget (₩)'}
            placeholderTextColor={txSc}
            autoFocus
          />
          <TouchableOpacity
            onPress={saveTarget}
            disabled={saving}
            style={{ backgroundColor: palette.coral500, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
              {saving ? '...' : (lang === 'ko' ? '저장' : 'Save')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditing(false)} style={{ padding: 6 }}>
            <Text style={{ color: txSc, fontSize: 13 }}>{lang === 'ko' ? '취소' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 진행 바 */}
      {target != null && (
        <>
          <View style={[S.barBg, { backgroundColor: bord }]}>
            <View style={[S.barFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#E74C3C' : palette.coral500 }]} />
          </View>
          <Text style={{ color: txSc, fontSize: 12, marginTop: 4 }}>
            {lang === 'ko'
              ? `목표 ₩${target.toLocaleString()} 의 ${pct.toFixed(0)}%`
              : `${pct.toFixed(0)}% of ₩${target.toLocaleString()}`}
          </Text>
        </>
      )}

      {!target && !editing && (
        <TouchableOpacity onPress={() => { setEditing(true); setInputVal(''); }}>
          <Text style={{ color: txSc, fontSize: 12, marginTop: 2 }}>
            {lang === 'ko' ? '+ 목표 예산 설정하기' : '+ Set target budget'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 카테고리별 합계 */}
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

const S = StyleSheet.create({
  budgetCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 8 },
  barBg:      { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill:    { height: '100%', borderRadius: 3 },
  badge:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});

