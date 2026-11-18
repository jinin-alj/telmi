import { readFileSync } from 'fs';
import { join } from 'path';

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { SERVER_ERROR_CODES } from '@/api/error-codes';
import { LanguageSwitch } from '@/components/language-switch';
import { en } from '@/i18n/en';
import { errorText } from '@/i18n/error-text';
import { es } from '@/i18n/es';
import { LanguageProvider, useLanguage, useTexts } from '@/i18n/language-context';
import { loadLanguage, saveLanguage } from '@/i18n/language-storage';
import { deviceLanguage } from '@/i18n/languages';

jest.mock('@/i18n/language-storage');

const mockedLoadLanguage = jest.mocked(loadLanguage);
const mockedSaveLanguage = jest.mocked(saveLanguage);

beforeEach(() => {
  jest.resetAllMocks();
  mockedLoadLanguage.mockResolvedValue(null);
});

/** Every key path in a texts object, like "signIn.submit", so two languages can be compared. */
function keyPaths(texts: object, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(texts)) {
    if (typeof value === 'object' && value !== null) {
      paths.push(...keyPaths(value, `${prefix}${key}.`));
    } else {
      paths.push(`${prefix}${key}`);
    }
  }
  return paths.sort();
}

function wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('texts', () => {
  it('has every English text in Spanish too', () => {
    expect(keyPaths(es)).toEqual(keyPaths(en));
  });

  it('knows exactly the error codes the server sends', () => {
    // The server's list lives in backend/app/services/errors.py
    const errorsFile = readFileSync(
      join(__dirname, '../../../backend/app/services/errors.py'),
      'utf8',
    );
    const listStart = errorsFile.indexOf('ErrorCode = Literal[');
    const list = errorsFile.slice(listStart, errorsFile.indexOf(']', listStart));
    const serverCodes = [...list.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);

    expect([...SERVER_ERROR_CODES].sort()).toEqual(serverCodes.sort());
  });
});

describe('deviceLanguage', () => {
  it('picks Spanish for any Spanish locale and English otherwise', () => {
    expect(deviceLanguage('es-ES')).toBe('es');
    expect(deviceLanguage('es-419')).toBe('es');
    expect(deviceLanguage('en-GB')).toBe('en');
    expect(deviceLanguage('fr-FR')).toBe('en');
  });
});

describe('errorText', () => {
  it('shows a server error in the chosen language', () => {
    const error = new ApiError(401, 'Wrong username or password', 'wrong_login');

    expect(errorText(error, es, 'fallback')).toBe(es.errors.wrong_login);
  });

  it("shows an older server's own message when it sends no code", () => {
    expect(errorText(new ApiError(409, 'Old message'), es, 'fallback')).toBe('Old message');
  });

  it('shows the fallback for anything that is not an API error', () => {
    expect(errorText(new Error('boom'), es, 'No se ha podido.')).toBe('No se ha podido.');
  });
});

describe('LanguageProvider', () => {
  it('starts in the saved language', async () => {
    mockedLoadLanguage.mockResolvedValue('es');

    const { result } = await renderHook(() => useTexts(), { wrapper });

    await waitFor(() => expect(result.current).toBe(es));
  });

  it('switches every text and remembers the choice', async () => {
    const { result } = await renderHook(() => ({ texts: useTexts(), ...useLanguage() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => result.current.setLanguage('es'));

    expect(result.current.language).toBe('es');
    expect(result.current.texts).toBe(es);
    expect(mockedSaveLanguage).toHaveBeenCalledWith('es');
  });

  it('uses English outside a provider, so screens can be tested alone', async () => {
    const { result } = await renderHook(() => useTexts());

    expect(result.current).toBe(en);
  });
});

describe('LanguageSwitch', () => {
  it('offers each language in its own words and switches on a tap', async () => {
    await render(
      <LanguageProvider>
        <LanguageSwitch />
      </LanguageProvider>,
    );
    await waitFor(() => expect(mockedLoadLanguage).toHaveBeenCalled());

    expect(screen.getByRole('radio', { name: 'English' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Español' }));

    expect(screen.getByLabelText(es.language.label)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked();
    expect(mockedSaveLanguage).toHaveBeenCalledWith('es');
  });
});
