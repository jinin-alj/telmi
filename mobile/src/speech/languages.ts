import type { AppLanguage } from '@/i18n/languages';

export type SpeechLanguage = 'en-US' | 'es-ES';

/** The voice and microphone language that goes with the language the app is shown in. */
export function speechLanguageFor(appLanguage: AppLanguage): SpeechLanguage {
  if (appLanguage === 'es') {
    return 'es-ES';
  }
  return 'en-US';
}
