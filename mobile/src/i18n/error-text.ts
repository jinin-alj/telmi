import { ApiError } from '@/api/client';
import type { Texts } from '@/i18n/en';

/** What to tell the person about a failed request, in their language. */
export function errorText(error: unknown, texts: Texts, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  if (error.code !== null) {
    return texts.errors[error.code];
  }
  // An older server sends no code, only its English message
  return error.message;
}
