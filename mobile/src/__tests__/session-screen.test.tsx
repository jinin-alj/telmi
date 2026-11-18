import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { changeSessionLanguage, getSession } from '@/api/study';
import type { StudySession } from '@/api/types';
import SessionScreen from '@/app/session/[sessionId]';
import { es } from '@/i18n/es';
import { LanguageProvider, useLanguage } from '@/i18n/language-context';
import { loadLanguage } from '@/i18n/language-storage';
import { speak } from '@/speech/text-to-speech';

jest.mock('expo-router', () => ({
  router: { canDismiss: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ sessionId: 'session-1' }),
  usePathname: () => '/session/session-1',
}));
jest.mock('@/api/study');
jest.mock('@/i18n/language-storage');
jest.mock('@/speech/text-to-speech', () => ({ speak: jest.fn(), stopSpeaking: jest.fn() }));
jest.mock('@/speech/use-speech-to-text', () => ({
  useSpeechToText: () => ({
    isAvailable: false,
    isListening: false,
    transcript: '',
    errorMessage: null,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    clearTranscript: jest.fn(),
  }),
}));

const SESSION: StudySession = {
  id: 'session-1',
  unit_id: 'unit-1',
  unit_title: 'Photosynthesis',
  status: 'active',
  started_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 15 * 60000).toISOString(),
  completed_at: null,
  student_turns_left: 8,
  turns: [{ position: 0, speaker: 'buddy', text: 'Hi! Can you explain it to me?' }],
  coverage_percent: null,
  feedback: null,
  application_answer: null,
  application_result: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSession).mockResolvedValue(SESSION);
  // The server rewrites the greeting only for Spanish, like a session started in English
  jest
    .mocked(changeSessionLanguage)
    .mockImplementation(async (_sessionId, language) =>
      language === 'es' ? SPANISH_SESSION : SESSION,
    );
});

/** The same session, with Pip's greeting rewritten in Spanish by the server. */
const SPANISH_SESSION: StudySession = {
  ...SESSION,
  turns: [{ position: 0, speaker: 'buddy', text: '¡Hola! ¿Me lo explicas?' }],
};

/** Shows the screen once the saved language is read, as the app's root layout does. */
function WhenLanguageLoaded({ children }: { children: ReactNode }) {
  const { loaded } = useLanguage();
  return loaded ? children : null;
}

/** Shows the session inside the app's language, starting in the given one. */
async function renderInLanguage(language: 'en' | 'es') {
  jest.mocked(loadLanguage).mockResolvedValue(language);
  await render(
    <LanguageProvider>
      <WhenLanguageLoaded>
        <SessionScreen />
      </WhenLanguageLoaded>
    </LanguageProvider>,
  );
}

it("doesn't repeat Pip's line when voice is turned off and on again", async () => {
  await render(<SessionScreen />);
  await screen.findByText('Hi! Can you explain it to me?');

  const voiceSwitch = screen.getByLabelText('Pip speaks out loud');
  await fireEvent(voiceSwitch, 'valueChange', false);
  await fireEvent(voiceSwitch, 'valueChange', true);

  expect(speak).toHaveBeenCalledTimes(1);
});

it('has one language switch, at the foot of the page', async () => {
  await renderInLanguage('en');
  await screen.findByText('Hi! Can you explain it to me?');

  expect(screen.queryByLabelText('Language you are speaking')).toBeNull();
  expect(screen.getAllByRole('radio')).toHaveLength(2);
});

it('opens in Spanish with Pip greeting and listening in Spanish', async () => {
  await renderInLanguage('es');

  expect(await screen.findByText('¡Hola! ¿Me lo explicas?')).toBeTruthy();
  expect(changeSessionLanguage).toHaveBeenCalledWith('session-1', 'es');
  expect(screen.getByRole('button', { name: es.session.finish })).toBeTruthy();
  // Pip never reads the English greeting first
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenCalledWith('¡Hola! ¿Me lo explicas?', 'es-ES', expect.anything());
});

it('greets again in Spanish when the app switches before the first answer', async () => {
  await renderInLanguage('en');
  await screen.findByText('Hi! Can you explain it to me?');

  await fireEvent.press(screen.getByRole('radio', { name: 'Español' }));

  expect(await screen.findByText('¡Hola! ¿Me lo explicas?')).toBeTruthy();
  expect(speak).toHaveBeenLastCalledWith('¡Hola! ¿Me lo explicas?', 'es-ES', expect.anything());
});

it('keeps the conversation once the student has answered', async () => {
  jest.mocked(getSession).mockResolvedValue({
    ...SESSION,
    turns: [
      ...SESSION.turns,
      { position: 1, speaker: 'student', text: 'Plants make food.' },
      { position: 2, speaker: 'buddy', text: 'How do they do that?' },
    ],
  });
  await renderInLanguage('en');
  await screen.findByText('How do they do that?');

  await fireEvent.press(screen.getByRole('radio', { name: 'Español' }));

  expect(await screen.findByRole('button', { name: es.session.finish })).toBeTruthy();
  expect(changeSessionLanguage).not.toHaveBeenCalled();
  expect(screen.getByText('How do they do that?')).toBeTruthy();
});
