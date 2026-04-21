import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'nativewind';

import {
  loadLanguagePreference,
  loadThemePreference,
  saveLanguagePreference,
  saveThemePreference,
} from '@/lib/preferences';
import type { LanguagePreference, MobileThemePreference } from '@/lib/types';

type PreferencesContextValue = {
  theme: MobileThemePreference;
  language: LanguagePreference;
  setTheme: (value: MobileThemePreference) => void;
  setLanguage: (value: LanguagePreference) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<MobileThemePreference>('system');
  const [language, setLanguageState] = useState<LanguagePreference>('en');

  useEffect(() => {
    loadThemePreference().then((value) => {
      setThemeState(value);
      setColorScheme(value);
    });
    loadLanguagePreference().then(setLanguageState);
  }, [setColorScheme]);

  const setTheme = (value: MobileThemePreference) => {
    setThemeState(value);
    setColorScheme(value);
    saveThemePreference(value).catch(() => {});
  };

  const setLanguage = (value: LanguagePreference) => {
    setLanguageState(value);
    saveLanguagePreference(value).catch(() => {});
  };

  const value = useMemo(
    () => ({
      theme,
      language,
      setTheme,
      setLanguage,
    }),
    [theme, language]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
