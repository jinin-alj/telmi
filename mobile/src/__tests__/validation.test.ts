import {
  normalizeUsername,
  validateDisplayName,
  validatePassword,
  validateUsername,
} from '@/auth/validation';
import { en } from '@/i18n/en';

describe('normalizeUsername', () => {
  it('trims and lowercases like the backend', () => {
    expect(normalizeUsername('  Ana_G ')).toBe('ana_g');
  });
});

describe('validateUsername', () => {
  it('accepts letters, numbers, dots and underscores', () => {
    expect(validateUsername('ana.g_2', en.validation)).toBeNull();
  });

  it('accepts mixed case because it is lowercased first', () => {
    expect(validateUsername('Ana_G', en.validation)).toBeNull();
  });

  it('rejects names that are too short or too long', () => {
    expect(validateUsername('ab', en.validation)).not.toBeNull();
    expect(validateUsername('a'.repeat(31), en.validation)).not.toBeNull();
  });

  it('rejects spaces and symbols', () => {
    expect(validateUsername('has space', en.validation)).not.toBeNull();
    expect(validateUsername('<script>', en.validation)).not.toBeNull();
  });
});

describe('validatePassword', () => {
  it('needs 8 to 128 characters', () => {
    expect(validatePassword('short', en.validation)).not.toBeNull();
    expect(validatePassword('long-enough', en.validation)).toBeNull();
    expect(validatePassword('x'.repeat(129), en.validation)).not.toBeNull();
  });
});

describe('validateDisplayName', () => {
  it('rejects a blank nickname', () => {
    expect(validateDisplayName('   ', en.validation)).not.toBeNull();
  });

  it('accepts a short nickname', () => {
    expect(validateDisplayName('Ana', en.validation)).toBeNull();
  });
});
