import { act, renderHook } from '@testing-library/react-native';

import { speechModule } from '@/speech/speech-module';
import { useSpeechToText } from '@/speech/use-speech-to-text';

// A speech module that never hears anything, so the test can check how it is stopped
jest.mock('@/speech/speech-module', () => {
  const { EventEmitter } = jest.requireActual('expo');
  const fakeModule = new EventEmitter();
  fakeModule.isRecognitionAvailable = () => true;
  fakeModule.abort = jest.fn();
  return { speechModule: fakeModule };
});
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

it('stops the microphone when the answer box closes, e.g. when time runs out', async () => {
  const { unmount } = await renderHook(() => useSpeechToText());

  await unmount();

  expect(speechModule?.abort).toHaveBeenCalled();
});

// The fake sends only the fields the hook reads, so its event types are loosened here
const fakeSpeechModule = speechModule as unknown as {
  emit: (eventName: string, event: object) => void;
};

/** Send an event from the fake speech module, as the browser or phone would. */
async function hear(eventName: string, event: object) {
  await act(async () => {
    fakeSpeechModule.emit(eventName, event);
  });
}

it('keeps a half-finished phrase when recognition stops without finishing it', async () => {
  const { result } = await renderHook(() => useSpeechToText());

  await hear('result', { isFinal: false, results: [{ transcript: 'plants make sugar' }] });
  await hear('end', {});

  expect(result.current.transcript).toBe('plants make sugar');
});

it('does not repeat a phrase that finished just before recognition stopped', async () => {
  const { result } = await renderHook(() => useSpeechToText());

  await hear('result', { isFinal: false, results: [{ transcript: 'plants make' }] });
  await hear('result', { isFinal: true, results: [{ transcript: 'plants make sugar' }] });
  await hear('end', {});

  expect(result.current.transcript).toBe('plants make sugar');
});
