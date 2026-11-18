import { isAppLanguage } from '@/i18n/languages';
import type { AppLanguage } from '@/i18n/languages';

const LANGUAGE_KEY = 'telmi.language';

/** The language picked in this browser, or null if none was picked or it can't be read. */
export async function loadLanguage(): Promise<AppLanguage | null> {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    return isAppLanguage(saved) ? saved : null;
  } catch (error) {
    console.warn('Could not read the saved language', error);
    return null;
  }
}

/** Remember the language picked in this browser. */
export async function saveLanguage(language: AppLanguage): Promise<void> {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    // The app still switches; it just starts in the browser's language next time
    console.warn('Could not save the language', error);
  }
}
