import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';

import { startErrorReporting as startOnPhones } from '@/monitoring/error-reporting';
import {
  keepBreadcrumb,
  NO_PERSONAL_DATA,
  scrubEvent,
  startErrorReporting,
} from '@/monitoring/error-reporting.web';

jest.mock('@sentry/react', () => ({ init: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));

const mockedInit = jest.mocked(Sentry.init);

beforeEach(() => {
  jest.clearAllMocks();
});

it('sends nothing without a Sentry address', () => {
  expect(startErrorReporting('')).toBe(false);
  expect(startErrorReporting(undefined)).toBe(false);
  expect(mockedInit).not.toHaveBeenCalled();
});

it('is set up to send no personal data', () => {
  expect(startErrorReporting('https://key@o1.ingest.de.sentry.io/2')).toBe(true);

  const options = mockedInit.mock.calls[0][0];
  expect(options?.dataCollection).toBe(NO_PERSONAL_DATA);
  expect(options?.beforeSend).toBe(scrubEvent);
  expect(options?.beforeBreadcrumb).toBe(keepBreadcrumb);
  expect(options?.release).toBe('telmi-web@1.2.3');
});

it('removes the user and request details from a crash report', () => {
  const event: ErrorEvent = {
    type: undefined,
    user: { ip_address: '203.0.113.5' },
    request: {
      url: 'https://telmi.example/session/abc',
      data: 'Plants eat soil',
      cookies: { session: 'secret' },
      headers: { Authorization: 'Bearer secret' },
      query_string: 'token=secret',
    },
  };

  const scrubbed = scrubEvent(event);

  expect(scrubbed.user).toBeUndefined();
  expect(scrubbed.request).toEqual({ url: 'https://telmi.example/session/abc' });
});

it('leaves out breadcrumbs that could hold what someone typed or clicked on', () => {
  expect(keepBreadcrumb({ category: 'ui.input', message: 'textarea' })).toBeNull();
  expect(keepBreadcrumb({ category: 'ui.click', message: 'button' })).toBeNull();
  expect(keepBreadcrumb({ category: 'console', message: 'Plants eat soil' })).toBeNull();
  expect(keepBreadcrumb({ category: 'navigation', data: { to: '/session/abc' } })).not.toBeNull();
});

it('does nothing on phones yet', () => {
  expect(startOnPhones()).toBe(false);
});
