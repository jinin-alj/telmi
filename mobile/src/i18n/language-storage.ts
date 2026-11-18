import * as SecureStore from 'expo-secure-store';

import { isAppLanguage } from '@/i18n/languages';
import type { AppLanguage } from '@/i18n/languages';

const LANGUAGE_KEY = 'telmi.language';

/** The language picked on this device, or null if none was picked or it can't be read. */
export async function loadLanguage(): Promise<AppLanguage | null> {
  try {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
    return isAppLanguage(saved) ? saved : null;
  } catch (error) {
    console.warn('Could not read the saved language', error);
    return null;
  }
}

/** Remember the language picked on this device. */
export async function saveLanguage(language: AppLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  } catch (error) {
    // The app still switches; it just starts in the device's language next time
    console.warn('Could not save the language', error);
  }
}
