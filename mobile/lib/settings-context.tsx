/**
 * 앱 전역 설정 Context
 * - 언어 (ko / en)
 * - 다크 모드 (light / dark)
 * AsyncStorage에 영속 저장. NativeWind의 setColorScheme으로 다크 모드 전환.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { createTranslator, type Lang } from '@/lib/i18n';

// ─── 저장 키 ──────────────────────────────────────────────────────────────────
const LANG_KEY  = '@triple/lang';
const THEME_KEY = '@triple/theme';

// ─── Context 타입 ─────────────────────────────────────────────────────────────
interface SettingsValue {
  lang: Lang;
  isDark: boolean;
  toggleLang: () => void;
  toggleDark: () => void;
  t: ReturnType<typeof createTranslator>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();

  const [lang, setLang]   = useState<Lang>('ko');
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);

  // 앱 시작 시 저장된 설정 복원
  useEffect(() => {
    (async () => {
      const [savedLang, savedTheme] = await Promise.all([
        AsyncStorage.getItem(LANG_KEY),
        AsyncStorage.getItem(THEME_KEY),
      ]);
      if (savedLang === 'ko' || savedLang === 'en') setLang(savedLang);
      const dark = savedTheme === 'dark';
      setIsDark(dark);
      setColorScheme(dark ? 'dark' : 'light');
      setReady(true);
    })();
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'ko' ? 'en' : 'ko';
    setLang(next);
    AsyncStorage.setItem(LANG_KEY, next);
  }

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    setColorScheme(next ? 'dark' : 'light');
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  const t = createTranslator(lang);

  // 설정 로드 전에는 렌더링 스킵 (흰 깜빡임 방지)
  if (!ready) return null;

  return (
    <SettingsContext.Provider value={{ lang, isDark, toggleLang, toggleDark, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
