import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { getSession } from '@/api/study';
import type { StudySession } from '@/api/types';
import SessionScreen from '@/app/session/[sessionId]';
import { speak } from '@/speech/text-to-speech';

jest.mock('expo-router', () => ({
  router: { canDismiss: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ sessionId: 'session-1' }),
  usePathname: () => '/session/session-1',
}));
jest.mock('@/api/study');
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
});

it("reads Pip's line once, not again when the language changes", async () => {
  await render(<SessionScreen />);
  await screen.findByText('Hi! Can you explain it to me?');

  // The session's own choice of speaking language, not the app's language at the foot
  const speakingLanguage = within(screen.getByLabelText('Language you are speaking'));
  await fireEvent.press(speakingLanguage.getByRole('radio', { name: 'Español' }));
  await fireEvent.press(speakingLanguage.getByRole('radio', { name: 'English' }));

  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenCalledWith('Hi! Can you explain it to me?', 'en-US', expect.anything());
});

it("doesn't repeat Pip's line when voice is turned off and on again", async () => {
  await render(<SessionScreen />);
  await screen.findByText('Hi! Can you explain it to me?');

  const voiceSwitch = screen.getByLabelText('Pip speaks out loud');
  await fireEvent(voiceSwitch, 'valueChange', false);
  await fireEvent(voiceSwitch, 'valueChange', true);

  expect(speak).toHaveBeenCalledTimes(1);
});
