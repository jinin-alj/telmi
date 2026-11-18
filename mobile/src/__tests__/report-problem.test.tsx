import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import { sendFeedback } from '@/api/feedback';
import ReportProblemScreen from '@/app/report-problem';
import { ReportProblemLink } from '@/components/report-problem-link';
import { es } from '@/i18n/es';
import { LanguageProvider } from '@/i18n/language-context';
import { loadLanguage } from '@/i18n/language-storage';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), canDismiss: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  usePathname: () => '/session/abc',
  useLocalSearchParams: () => ({ from: '/session/abc' }),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.3' } }));
jest.mock('@/api/feedback', () => ({ sendFeedback: jest.fn() }));
jest.mock('@/i18n/language-storage');

const mockedSend = jest.mocked(sendFeedback);

beforeEach(() => {
  jest.clearAllMocks();
});

it('opens the report page, remembering where the person was', async () => {
  await render(<ReportProblemLink />);

  await fireEvent.press(screen.getByRole('link', { name: 'Report a problem' }));

  expect(router.push).toHaveBeenCalledWith({
    pathname: '/report-problem',
    params: { from: '/session/abc' },
  });
});

it('sends the report with the page and app version, then thanks the person', async () => {
  mockedSend.mockResolvedValue();
  await render(<ReportProblemScreen />);

  await fireEvent.changeText(
    screen.getByLabelText('What went wrong?'),
    'The microphone stopped after one sentence.',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

  await waitFor(() => expect(screen.getByText(/Thanks/)).toBeTruthy());
  expect(screen.getByTestId('pip-proud', { includeHiddenElements: true })).toBeTruthy();
  expect(mockedSend).toHaveBeenCalledWith({
    message: 'The microphone stopped after one sentence.',
    page: '/session/abc',
    app_version: '1.2.3',
  });
});

it('asks for a description before sending', async () => {
  await render(<ReportProblemScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

  expect(screen.getByText('Say what went wrong first.')).toBeTruthy();
  expect(mockedSend).not.toHaveBeenCalled();
});

it('keeps the text and explains when sending fails', async () => {
  mockedSend.mockRejectedValue(new ApiError(429, 'Too many tries. Wait a minute, then try again.'));
  await render(<ReportProblemScreen />);

  await fireEvent.changeText(screen.getByLabelText('What went wrong?'), 'It froze.');
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

  expect(await screen.findByText('Too many tries. Wait a minute, then try again.')).toBeTruthy();
  expect(screen.getByLabelText('What went wrong?').props.value).toBe('It froze.');
});

it('asks and thanks in Spanish', async () => {
  jest.mocked(loadLanguage).mockResolvedValue('es');
  mockedSend.mockResolvedValue(undefined);
  await render(
    <LanguageProvider>
      <ReportProblemScreen />
    </LanguageProvider>,
  );

  const send = await screen.findByRole('button', { name: es.reportProblem.send });
  await fireEvent.press(send);
  expect(screen.getByText(es.reportProblem.missing)).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText(es.reportProblem.label), 'No carga la clase');
  await fireEvent.press(send);

  await waitFor(() =>
    expect(screen.getByRole('header', { name: es.reportProblem.thanks })).toBeTruthy(),
  );
});
