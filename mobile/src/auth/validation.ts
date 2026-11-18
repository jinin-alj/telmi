import type { Texts } from '@/i18n/en';

type ValidationTexts = Texts['validation'];

// Mirrors the backend rules in backend/app/schemas/auth.py so errors show before sending
const USERNAME_PATTERN = /^[a-z0-9_.]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const DISPLAY_NAME_MAX_LENGTH = 40;

/** Trim and lowercase, the same way the backend stores usernames. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Return an error message for the username, or null if it's valid. */
export function validateUsername(username: string, texts: ValidationTexts): string | null {
  const normalized = normalizeUsername(username);
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return texts.atLeast(USERNAME_MIN_LENGTH);
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return texts.atMost(USERNAME_MAX_LENGTH);
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return texts.usernameCharacters;
  }
  return null;
}

/** Return an error message for the password, or null if it's valid. */
export function validatePassword(password: string, texts: ValidationTexts): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return texts.atLeast(PASSWORD_MIN_LENGTH);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return texts.atMost(PASSWORD_MAX_LENGTH);
  }
  return null;
}

/** Return an error message for the nickname, or null if it's valid. */
export function validateDisplayName(displayName: string, texts: ValidationTexts): string | null {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return texts.nicknameMissing;
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return texts.atMost(DISPLAY_NAME_MAX_LENGTH);
  }
  return null;
}
