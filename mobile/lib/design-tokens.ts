/**
 * 디자인 토큰 — 단일 진실 원천(Single Source of Truth).
 *
 * 시맨틱 NativeWind 클래스(bg-bg-base, text-tx-primary 등)는
 * `global.css`의 CSS 변수로 자동 light/dark 전환된다.
 * 이 파일은 RN 인라인 style에서 같은 토큰을 참조할 때 사용한다.
 *
 * 사용 가이드:
 *  - NativeWind className → CSS 변수가 자동 전환 (별도 작업 불필요)
 *  - 인라인 style → `useThemedColors()` 훅으로 현재 테마의 색을 받기
 *  - 컴포넌트 외부(상수) → light 기본값 사용 (예: ActivityIndicator color)
 */

import { useColorScheme } from 'react-native';

export const palette = {
  // Brand
  coral50:  '#FFF1F2',
  coral100: '#FFE4E6',
  coral300: '#FDA4AF',
  coral500: '#FF5A5F',
  coral600: '#E14B50',
  coral700: '#B91C1C',

  teal50:  '#ECFEFF',
  teal100: '#CFFAFE',
  teal300: '#67E8F9',
  teal500: '#00A699',
  teal600: '#0E8C82',
  teal700: '#0F766E',

  // Legacy 시안
  cyan500: '#3DC3EE',
  cyan600: '#2BA9D1',

  // Neutrals
  ink900: '#0F172A',
  ink800: '#1A2E44',
  ink700: '#1E293B',
  ink600: '#475569',
  ink500: '#64748B',
  ink400: '#9BA7B5',
  ink300: '#CBD5E1',
  ink200: '#E2E8F0',
  ink100: '#E8ECF2',
  ink50:  '#F1F5F9',
  warmWhite: '#FAFAF7',
  white:  '#FFFFFF',
  black:  '#000000',

  // State
  success500: '#10B981',
  warning500: '#F59E0B',
  danger500:  '#EF4444',
  danger50:   '#FEF2F2',
  info500:    '#3B82F6',
} as const;

/**
 * 시맨틱 컬러 — light/dark 페어.
 * 인라인 style에서 useThemedColors()로 접근.
 */
export const lightColors: ThemedColors = {
  // brand
  brandPrimary:   palette.coral500,
  brandSecondary: palette.teal500,

  // text
  txPrimary:   palette.ink900,
  txSecondary: palette.ink600,
  txTertiary:  palette.ink400,
  txDisabled:  palette.ink300,
  txInverse:   palette.white,
  txBrand:     palette.coral500,
  txDanger:    palette.danger500,

  // bg
  bgBase:    palette.warmWhite,
  bgSurface: palette.white,
  bgSubtle:  palette.ink50,
  bgStrong:  palette.ink100,

  // input / card
  inputBg:   palette.ink50,
  cardBg:    palette.white,

  // line
  lineDefault: palette.ink100,
  lineStrong:  palette.ink200,

  // 화살표(›) — 라이트에서 mid-gray
  chevron:   palette.ink400,

  // 경고/충돌 카드 — 라이트
  warnBg:     '#FFF1E6',
  warnBorder: '#FFB07A',
  warnText:   '#7A3700',
  warnSub:    '#9A5A2A',

  // 선택 강조 (보관함 여행/날짜 선택)
  accentBg:   '#E8F8FD',
  accentText: '#3DC3EE',

  // 그림자 색
  shadowColor: palette.ink800,
};

export const darkColors: ThemedColors = {
  brandPrimary:   palette.coral500,
  brandSecondary: palette.teal500,

  // 다크모드 텍스트 — 대비 강화
  txPrimary:   '#F1F5F9',          // 순백 대신 약간 부드러운 흰색
  txSecondary: '#CBD5E1',          // 확실히 보이는 회색
  txTertiary:  '#94A3B8',          // 보조 텍스트 (충분히 밝음)
  txDisabled:  '#475569',
  txInverse:   palette.ink900,
  txBrand:     palette.coral500,
  txDanger:    '#F87171',          // 다크에서 더 밝은 빨강

  // 다크모드 배경 — ink 시스템 통일
  bgBase:    '#0F172A',            // 최하단 (ink900)
  bgSurface: '#1E293B',            // 카드/모달 (ink700)
  bgSubtle:  '#334155',            // 입력/뱃지 배경
  bgStrong:  '#475569',            // 강조 배경

  // input / card
  inputBg:   '#1E293B',
  cardBg:    '#1E293B',

  // line
  lineDefault: '#334155',
  lineStrong:  '#475569',

  // 화살표(›) — 다크에서 명확하게 밝게
  chevron:   '#94A3B8',            // txTertiary보다 확실히 밝음

  // 경고/충돌 카드 — 다크
  warnBg:     '#2D1A0A',
  warnBorder: '#92400E',
  warnText:   '#FCD34D',
  warnSub:    '#FCA5A5',

  // 선택 강조
  accentBg:   '#0F3044',
  accentText: '#38BDF8',

  // 그림자
  shadowColor: palette.black,
};

/**
 * 도메인 키들. 새 토큰 추가 시 여기에 추가.
 */
export type ThemedColors = {
  brandPrimary: string;
  brandSecondary: string;
  txPrimary: string;
  txSecondary: string;
  txTertiary: string;
  txDisabled: string;
  txInverse: string;
  txBrand: string;
  txDanger: string;
  bgBase: string;
  bgSurface: string;
  bgSubtle: string;
  bgStrong: string;
  inputBg: string;
  cardBg: string;
  lineDefault: string;
  lineStrong: string;
  chevron: string;
  warnBg: string;
  warnBorder: string;
  warnText: string;
  warnSub: string;
  accentBg: string;
  accentText: string;
  shadowColor: string;
};

/** OS 시스템 모드에 따라 현재 테마의 색 객체를 반환 */
export function useThemedColors(): ThemedColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

/**
 * 그림자 — RN shadow / Android elevation 동시.
 * 인라인 style 객체로 펼쳐 사용. shadowColor만 다크에서 override.
 */
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: palette.ink800,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardStrong: {
    shadowColor: palette.ink800,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  fab: {
    shadowColor: palette.coral500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const radius = {
  xs: 4, sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, '3xl': 24, full: 9999,
} as const;

export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  h1:      { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  h2:      { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  h3:      { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySm:  { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  button:  { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
} as const;

/** placeholder는 테마와 무관하게 보조 색 (TextField 등 컴포넌트에서 useThemedColors 사용 권장) */
export const placeholderColor = palette.ink400;
