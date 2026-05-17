/**
 * 한국 여행 도구 모음 (일본인 관광객 관점).
 *
 * 일본 toolkit과 대칭 구조:
 *  - 환율: JPY → KRW 기본 방향, 양방향 스왑
 *  - 회화: 일본어 → 한국어 (정적 사전 + Gemini)
 *  - 교통: T-money / 디스커버 서울 패스 / KTX / 공항 리무진
 *  - 면세: 한국 사후환급·즉시환급
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import {
  KOREA_PHRASE_CATEGORIES,
  KOREA_PHRASES,
  type KoreanPhrase,
  type KoreaPhraseCategory,
} from '@/data/korea/phrases';
import { KOREA_TRANSIT_PASSES, passesForKoreanCity } from '@/data/korea/transit';
import { KOREA_TAX_FREE_OVERVIEW, KOREA_TAX_FREE_STEPS, KOREA_TAX_FREE_TIPS } from '@/data/korea/tax-free';

type Tab = 'exchange' | 'phrase' | 'transit' | 'taxfree';

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'exchange', label: '환율',  emoji: '💱' },
  { key: 'phrase',   label: '회화',  emoji: '💬' },
  { key: 'transit',  label: '교통',  emoji: '🚇' },
  { key: 'taxfree',  label: '면세',  emoji: '💸' },
];

export default function KoreaToolkit() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: Tab; city?: string }>();
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'exchange');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colors.txPrimary, marginLeft: 8 }}>
          🇰🇷 한국 여행 도구
        </Text>
      </View>

      <View style={{ flexShrink: 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flexShrink: 0,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: 6,
                  alignItems: 'center',
                  backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: active ? colors.brandPrimary : colors.lineDefault,
                }}>
                <Text allowFontScaling={false} style={{ fontSize: 14 }}>{t.emoji}</Text>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : colors.txSecondary,
                  }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'exchange' && <ExchangeSection />}
        {tab === 'phrase' && <PhraseSection />}
        {tab === 'transit' && <TransitSection cityHint={params.city ?? null} />}
        {tab === 'taxfree' && <TaxFreeSection />}
      </ScrollView>
    </View>
  );
}

// ─── 환율 (JPY ↔ KRW, 일본인 관점이므로 기본 JPY→KRW) ────────────────────────

type ExchangeDirection = 'JPY_TO_KRW' | 'KRW_TO_JPY';

function ExchangeSection() {
  const colors = useThemedColors();
  // rate 정의: 1 KRW = X JPY (백엔드와 동일 단일 진실 원천)
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [direction, setDirection] = useState<ExchangeDirection>('JPY_TO_KRW');
  const [input, setInput] = useState('10000');  // 기본 ¥10,000

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await api.utils.exchangeRate('KRW', 'JPY');
      setRate(r.rate);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErrorMsg(err?.message ?? '환율을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fromIsJPY = direction === 'JPY_TO_KRW';
  const fromLabel = fromIsJPY ? '일본 엔 (JPY)' : '한국 원 (KRW)';
  const toLabel   = fromIsJPY ? '한국 원 (KRW)' : '일본 엔 (JPY)';
  const fromSymbol = fromIsJPY ? '¥' : '₩';
  const toSymbol   = fromIsJPY ? '₩' : '¥';

  const inputNum = Number(input.replace(/,/g, '')) || 0;
  const converted = rate === null
    ? null
    : fromIsJPY
      ? inputNum / rate           // JPY ÷ (JPY per KRW) = KRW
      : inputNum * rate;          // KRW × (JPY per KRW) = JPY

  const krwPer100Jpy = rate ? 100 / rate : null;

  const swapDirection = () => {
    setDirection((d) => (d === 'JPY_TO_KRW' ? 'KRW_TO_JPY' : 'JPY_TO_KRW'));
    if (converted !== null) {
      setInput(String(Math.round(converted)));
    }
  };

  const presets = fromIsJPY
    ? [100, 500, 1000, 5000, 10000]
    : [1000, 5000, 10000, 50000, 100000];

  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.bgSurface,
          borderWidth: 1,
          borderColor: colors.lineDefault,
        }}>
        <Text style={{ fontSize: 13, color: colors.txTertiary, marginBottom: 4 }}>{fromLabel}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, color: colors.txTertiary }}>{fromSymbol}</Text>
          <TextInput
            value={input}
            onChangeText={(v) => setInput(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            style={{
              flex: 1,
              fontSize: 28,
              fontWeight: '800',
              color: colors.txPrimary,
              paddingVertical: 4,
            }}
          />
        </View>
      </View>

      <View style={{ alignItems: 'center' }}>
        <TouchableOpacity
          onPress={swapDirection}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.lineDefault,
          }}>
          <Text style={{ fontSize: 18, color: colors.brandPrimary, fontWeight: '800' }}>⇅</Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.brandPrimary,
        }}>
        <Text style={{ fontSize: 13, color: '#FFE7E9', marginBottom: 4 }}>{toLabel}</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF' }}>
          {converted === null
            ? '—'
            : `${toSymbol} ${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: colors.txTertiary }}>
          {loading
            ? '환율 갱신 중…'
            : krwPer100Jpy
              ? `100엔 = ${krwPer100Jpy.toFixed(2)}원`
              : '환율 정보 없음'}
        </Text>
        <TouchableOpacity onPress={load} disabled={loading}>
          <Text style={{ fontSize: 12, color: colors.brandPrimary, fontWeight: '700' }}>
            새로고침
          </Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? (
        <Text style={{ fontSize: 12, color: colors.txDanger }}>{errorMsg}</Text>
      ) : null}

      <View style={{ gap: 8, marginTop: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.txSecondary }}>빠른 환산</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {presets.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => setInput(String(v))}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.lineDefault,
              }}>
              <Text style={{ fontSize: 12, color: colors.txSecondary, fontWeight: '600' }}>
                {fromSymbol}{v.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── 회화 (일본어 → 한국어) ───────────────────────────────────────────────────

function PhraseSection() {
  const colors = useThemedColors();
  const [activeCat, setActiveCat] = useState<KoreaPhraseCategory>('greeting');
  const [freeInput, setFreeInput] = useState('');
  const [aiResult, setAiResult] = useState<{
    japanese: string; korean: string; romanized: string; note: string | null;
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const translate = async () => {
    if (!freeInput.trim()) return;
    setTranslating(true);
    setErrorMsg(null);
    try {
      const result = await api.korean.translate({ text: freeInput, context: 'casual', formality: 'polite' });
      setAiResult(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(err?.response?.data?.message ?? err?.message ?? '번역에 실패했어요');
    } finally {
      setTranslating(false);
    }
  };

  const items: KoreanPhrase[] = KOREA_PHRASES[activeCat];

  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.bgSurface,
          borderWidth: 1,
          borderColor: colors.lineDefault,
          gap: 10,
        }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.txSecondary }}>
          AI 번역 (일본어 → 한국어)
        </Text>
        <TextInput
          value={freeInput}
          onChangeText={setFreeInput}
          placeholder="例: 辛くしないでください"
          placeholderTextColor={colors.txTertiary}
          maxLength={200}
          style={{
            fontSize: 14,
            color: colors.txPrimary,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: colors.bgBase,
            borderWidth: 1,
            borderColor: colors.lineDefault,
          }}
        />
        <TouchableOpacity
          onPress={translate}
          disabled={translating || !freeInput.trim()}
          style={{
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
            backgroundColor: !freeInput.trim() || translating ? colors.bgStrong : colors.brandPrimary,
          }}>
          {translating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>번역하기 / 翻訳</Text>
          )}
        </TouchableOpacity>
        {errorMsg ? <Text style={{ fontSize: 12, color: colors.txDanger }}>{errorMsg}</Text> : null}
        {aiResult ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.txPrimary }}>{aiResult.korean}</Text>
            <Text style={{ fontSize: 12, color: colors.txTertiary, fontStyle: 'italic' }}>{aiResult.romanized}</Text>
            {aiResult.note ? (
              <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 4 }}>💡 {aiResult.note}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ flexShrink: 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ gap: 8 }}>
          {KOREA_PHRASE_CATEGORIES.map((c) => {
            const active = c.key === activeCat;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setActiveCat(c.key)}
                style={{
                  flexShrink: 0,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: 4,
                  alignItems: 'center',
                  backgroundColor: active ? colors.txPrimary : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: active ? colors.txPrimary : colors.lineDefault,
                }}>
                <Text style={{ fontSize: 13 }} allowFontScaling={false}>{c.emoji}</Text>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={{ fontSize: 12, fontWeight: '700', color: active ? colors.bgBase : colors.txSecondary }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 10 }}>
        {items.map((p, idx) => (
          <View
            key={idx}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.lineDefault,
            }}>
            <Text style={{ fontSize: 13, color: colors.txTertiary }}>{p.japanese}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.txPrimary, marginTop: 4 }}>
              {p.korean}
            </Text>
            <Text style={{ fontSize: 12, color: colors.txTertiary, fontStyle: 'italic', marginTop: 2 }}>
              {p.romanized}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── 교통 ─────────────────────────────────────────────────────────────────────

function TransitSection({ cityHint }: { cityHint: string | null }) {
  const colors = useThemedColors();
  const passes = useMemo(
    () => (cityHint ? passesForKoreanCity(cityHint) : KOREA_TRANSIT_PASSES),
    [cityHint],
  );

  return (
    <View style={{ gap: 12 }}>
      {passes.map((p) => (
        <View
          key={p.key}
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.lineDefault,
            gap: 10,
          }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.txPrimary }}>{p.name}</Text>
            <Text style={{ fontSize: 12, color: colors.txTertiary, marginTop: 2 }}>👌 {p.bestFor}</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {p.priceKRW.map((tier) => (
              <View
                key={tier.days}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: colors.bgSubtle,
                }}>
                <Text style={{ fontSize: 11, color: colors.txTertiary }}>
                  {tier.days === 0 ? '시작' : `${tier.days}일`}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary }}>
                  ₩{tier.price.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.txSecondary, marginBottom: 4 }}>
              포함
            </Text>
            {p.coverage.map((c) => (
              <Text key={c} style={{ fontSize: 12, color: colors.txSecondary }}>• {c}</Text>
            ))}
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.txSecondary, marginBottom: 4 }}>
              주의
            </Text>
            {p.notes.map((n) => (
              <Text key={n} style={{ fontSize: 12, color: colors.txTertiary }}>⚠️ {n}</Text>
            ))}
          </View>

          <Pressable onPress={() => Linking.openURL(p.officialUrl)} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: colors.brandPrimary, fontWeight: '700' }}>
              공식 페이지 열기 →
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ─── 면세 ─────────────────────────────────────────────────────────────────────

function TaxFreeSection() {
  const colors = useThemedColors();
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.brandPrimary,
        }}>
        <Text style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 19 }}>
          {KOREA_TAX_FREE_OVERVIEW}
        </Text>
      </View>

      {KOREA_TAX_FREE_STEPS.map((s, idx) => (
        <View
          key={idx}
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.lineDefault,
          }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary }}>{s.title}</Text>
          <Text style={{ fontSize: 13, color: colors.txSecondary, marginTop: 4, lineHeight: 19 }}>
            {s.body}
          </Text>
        </View>
      ))}

      <View style={{ marginTop: 6, gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary }}>💡 추가 꿀팁</Text>
        {KOREA_TAX_FREE_TIPS.map((t) => (
          <Text key={t} style={{ fontSize: 13, color: colors.txSecondary, lineHeight: 19 }}>
            • {t}
          </Text>
        ))}
      </View>
    </View>
  );
}
