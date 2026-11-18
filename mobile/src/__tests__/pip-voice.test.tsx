import { act, renderHook } from '@testing-library/react-native';

import { mouthForWord } from '@/features/session/pip-talk';
import { usePipVoice } from '@/features/session/use-pip-voice';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { speak, stopSpeaking } from '@/speech/text-to-speech';
import type { SpeechEvents } from '@/speech/text-to-speech';
import { wordAt } from '@/speech/words';

jest.mock('@/speech/text-to-speech', () => ({ speak: jest.fn(), stopSpeaking: jest.fn() }));
jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn() }));

const mockedSpeak = jest.mocked(speak);

/** The word events the voice was given for its latest line. */
function voiceEvents(): SpeechEvents {
  const calls = mockedSpeak.mock.calls;
  return calls[calls.length - 1][2];
}

async function wait(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  jest.mocked(useReduceMotion).mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('word helpers', () => {
  it('finds the word the voice is reading', () => {
    expect(wordAt('Hi! Can you explain it?', 4)).toBe('Can');
    expect(wordAt('Hi! Can you explain it?', 12)).toBe('explain');
  });

  it('opens wide for long words and a little for short ones, accents included', () => {
    expect(mouthForWord('photosynthesis')).toBe('wide');
    expect(mouthForWord('it')).toBe('small');
    expect(mouthForWord('además')).toBe('wide');
    expect(mouthForWord('sí?!')).toBe('small');
  });
});

describe('usePipVoice', () => {
  it('opens the mouth on each word the voice reads, then closes it and rests when done', async () => {
    const { result } = await renderHook(() => usePipVoice());

    await act(async () => {
      result.current.speakLine('Can you explain photosynthesis?', 'en-US');
    });
    expect(mockedSpeak).toHaveBeenCalledWith(
      'Can you explain photosynthesis?',
      'en-US',
      expect.anything(),
    );
    expect(result.current.mouth).toBe('smile');

    await act(async () => {
      voiceEvents().onWord('photosynthesis');
    });
    expect(result.current.mouth).toBe('wide');

    await wait(300);
    expect(result.current.mouth).toBe('smile');

    await act(async () => {
      voiceEvents().onEnd();
    });
    expect(result.current.mouth).toBeNull();
  });

  it('talks to a steady rhythm when the voice never says which word it is on', async () => {
    const { result } = await renderHook(() => usePipVoice());
    await act(async () => {
      result.current.speakLine('Can you explain it?', 'en-US');
      voiceEvents().onStart();
    });

    await wait(460);

    expect(result.current.mouth).toBe('small');
  });

  it('moves the mouth for a moment when the voice is off, then rests', async () => {
    const { result } = await renderHook(() => usePipVoice());

    await act(async () => {
      result.current.mumble('Hi! I missed the class on cell respiration. Can you explain it?');
    });
    expect(result.current.mouth).toBe('small');
    expect(mockedSpeak).not.toHaveBeenCalled();

    await wait(5000);
    expect(result.current.mouth).toBeNull();
  });

  it('still opens the mouth with reduced motion, so it is clear who is talking', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    const { result } = await renderHook(() => usePipVoice());
    await act(async () => {
      result.current.speakLine('Can you explain it?', 'en-US');
      voiceEvents().onWord('explain');
    });

    await wait(1000);

    expect(result.current.mouth).toBe('small');
  });

  it('stops talking at once and ignores late words from the old line', async () => {
    const { result } = await renderHook(() => usePipVoice());
    await act(async () => {
      result.current.speakLine('Can you explain it?', 'en-US');
    });
    const oldLine = voiceEvents();

    await act(async () => {
      result.current.stop();
      oldLine.onWord('explain');
    });

    expect(stopSpeaking).toHaveBeenCalled();
    expect(result.current.mouth).toBeNull();
  });
});
