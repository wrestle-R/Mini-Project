import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePreference, MobileThemePreference } from '@/lib/types';

const THEME_KEY = 'buildsync_mobile_theme';
const LANGUAGE_KEY = 'buildsync_mobile_language';

export async function loadThemePreference(): Promise<MobileThemePreference> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export async function saveThemePreference(value: MobileThemePreference) {
  await AsyncStorage.setItem(THEME_KEY, value);
}

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (value === 'en' || value === 'hi' || value === 'mr') {
    return value;
  }
  return 'en';
}

export async function saveLanguagePreference(value: LanguagePreference) {
  await AsyncStorage.setItem(LANGUAGE_KEY, value);
}
