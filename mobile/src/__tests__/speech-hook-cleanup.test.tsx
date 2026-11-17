import { renderHook } from '@testing-library/react-native';

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
