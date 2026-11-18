import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { en } from '@/i18n/en';
import type { Texts } from '@/i18n/en';
import { es } from '@/i18n/es';
import { loadLanguage, saveLanguage } from '@/i18n/language-storage';
import { deviceLanguage } from '@/i18n/languages';
import type { AppLanguage } from '@/i18n/languages';

const TEXTS: Record<AppLanguage, Texts> = { en, es };

type LanguageState = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  // False until the saved choice is read, so the app doesn't flash the wrong language
  loaded: boolean;
};

// English with nothing to switch, for screens rendered on their own in tests
const LanguageContext = createContext<LanguageState>({
  language: 'en',
  setLanguage: () => {},
  loaded: true,
});

/** Holds the app's language: the saved choice, or the device's language the first time. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => deviceLanguage());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadLanguage().then((saved) => {
      if (!active) {
        return;
      }
      if (saved !== null) {
        setLanguageState(saved);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Screen readers and browser translation read the page's language from here
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.documentElement.lang = language;
    }
  }, [language]);

  function setLanguage(newLanguage: AppLanguage) {
    setLanguageState(newLanguage);
    saveLanguage(newLanguage);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, loaded }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** The current language, a way to change it, and whether the saved choice has been read. */
export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

/** Every text the app shows, in the current language. */
export function useTexts(): Texts {
  return TEXTS[useContext(LanguageContext).language];
}
