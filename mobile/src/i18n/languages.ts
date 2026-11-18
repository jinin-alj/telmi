export type AppLanguage = 'en' | 'es';

/** Whether a saved value is one of the app's languages. */
export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'es';
}

/** Spanish if the device is set to any kind of Spanish, otherwise English. */
export function deviceLanguage(
  deviceLocale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): AppLanguage {
  if (deviceLocale.toLowerCase().startsWith('es')) {
    return 'es';
  }
  return 'en';
}
