import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { readDrawing } from '@/api/study';
import { ScrollLockContext } from '@/components/screen';
import { VoiceInput } from '@/features/session/voice-input';
import { useSpeechToText } from '@/speech/use-speech-to-text';

jest.mock('@/speech/use-speech-to-text', () => ({ useSpeechToText: jest.fn() }));
jest.mock('@/api/study', () => ({ readDrawing: jest.fn() }));

const mockedReadDrawing = jest.mocked(readDrawing);

const mockedUseSpeechToText = jest.mocked(useSpeechToText);
const startListening = jest.fn();
const stopListening = jest.fn();
const clearTranscript = jest.fn();

function mockSpeech(overrides: Partial<ReturnType<typeof useSpeechToText>>) {
  mockedUseSpeechToText.mockReturnValue({
    isAvailable: true,
    isListening: false,
    transcript: '',
    errorMessage: null,
    startListening,
    stopListening,
    clearTranscript,
    ...overrides,
  });
}

async function renderInput(onSubmit: (text: string) => Promise<void>) {
  await render(
    <VoiceInput
      sessionId="session-1"
      language="es-ES"
      prompt="Tap and explain it from memory"
      typingPrompt="Type your explanation from memory"
      submitLabel="Send to Pip"
      onSubmit={onSubmit}
    />,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
});

it('listens in the chosen language when the microphone is tapped', async () => {
  mockSpeech({});
  await renderInput(jest.fn());

  await fireEvent.press(screen.getByRole('button', { name: 'Tap to talk' }));

  expect(startListening).toHaveBeenCalledWith('es-ES');
});

it('stops listening when tapped again', async () => {
  mockSpeech({ isListening: true, transcript: 'Plants make' });
  await renderInput(jest.fn());

  await fireEvent.press(screen.getByRole('button', { name: 'Stop talking' }));

  expect(stopListening).toHaveBeenCalled();
});

it('lets the student fix what was heard before sending', async () => {
  mockSpeech({ transcript: 'Plants make food in chlorophyll' });
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  await renderInput(onSubmit);

  await fireEvent.changeText(
    screen.getByLabelText('What Pip heard. You can fix mistakes here.'),
    'Plants make food in chloroplasts',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Plants make food in chloroplasts'));
  expect(clearTranscript).toHaveBeenCalled();
});

it('falls back to typing when the browser cannot recognise speech', async () => {
  mockSpeech({ isAvailable: false });
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  await renderInput(onSubmit);

  expect(screen.queryByRole('button', { name: 'Tap to talk' })).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText('Type your explanation from memory'),
    '  Plants make food.  ',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Plants make food.'));
});

it('keeps the text and shows the error when sending fails', async () => {
  mockSpeech({ transcript: 'Plants make food' });
  const onSubmit = jest
    .fn()
    .mockRejectedValue(new ApiError(503, "Your buddy can't answer right now."));
  await renderInput(onSubmit);

  await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));

  await waitFor(() => expect(screen.getByText("Your buddy can't answer right now.")).toBeTruthy());
  expect(clearTranscript).not.toHaveBeenCalled();
});

describe('drawing', () => {
  /** A finger touching the canvas at a point, as React Native reports it. */
  function touch(x: number, y: number) {
    return { nativeEvent: { locationX: x, locationY: y } };
  }

  async function openDrawing() {
    await fireEvent.press(screen.getByRole('button', { name: 'Draw instead' }));
    const canvas = screen.getByLabelText('Drawing area');
    await fireEvent(canvas, 'layout', { nativeEvent: { layout: { width: 300, height: 240 } } });
    return canvas;
  }

  async function drawLine(canvas: ReturnType<typeof screen.getByLabelText>) {
    await fireEvent(canvas, 'responderGrant', touch(10, 10));
    await fireEvent(canvas, 'responderMove', touch(60, 60));
    await fireEvent(canvas, 'responderRelease', touch(60, 60));
  }

  it('reads the drawing into text the student checks, then sends it', async () => {
    mockSpeech({});
    mockedReadDrawing.mockResolvedValue({ text: 'H₂ + O₂ → H₂O' });
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await renderInput(onSubmit);
    const canvas = await openDrawing();

    await fireEvent.press(screen.getByRole('button', { name: 'Red pen' }));
    await drawLine(canvas);
    await fireEvent.press(screen.getByRole('button', { name: 'Read my drawing' }));

    await waitFor(() =>
      expect(
        screen.getByLabelText('What Pip read from your drawing. You can fix mistakes here.').props
          .value,
      ).toBe('H₂ + O₂ → H₂O'),
    );
    expect(mockedReadDrawing).toHaveBeenCalledWith('session-1', {
      width: 300,
      height: 240,
      strokes: [
        {
          color: 'red',
          points: [
            [10, 10],
            [60, 60],
          ],
        },
      ],
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Send to Pip' }));
    expect(onSubmit).toHaveBeenCalledWith('H₂ + O₂ → H₂O');
  });

  it('erases a line the eraser touches', async () => {
    mockSpeech({});
    await renderInput(jest.fn());
    const canvas = await openDrawing();
    await drawLine(canvas);

    await fireEvent.press(screen.getByRole('button', { name: 'Eraser' }));
    await fireEvent(canvas, 'responderGrant', touch(35, 35));
    await fireEvent(canvas, 'responderRelease', touch(35, 35));

    expect(screen.getByRole('button', { name: 'Read my drawing' })).toBeDisabled();
  });

  it('keeps the drawing and explains when it could not be read', async () => {
    mockSpeech({});
    mockedReadDrawing.mockRejectedValue(
      new ApiError(503, "Pip can't read your drawing right now. Try again, or type instead."),
    );
    await renderInput(jest.fn());
    const canvas = await openDrawing();
    await drawLine(canvas);

    await fireEvent.press(screen.getByRole('button', { name: 'Read my drawing' }));

    expect(
      await screen.findByText("Pip can't read your drawing right now. Try again, or type instead."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read my drawing' })).toBeEnabled();
  });

  it('pauses page scrolling only while the pen is down', async () => {
    mockSpeech({});
    const lockScroll = jest.fn();
    await render(
      <ScrollLockContext.Provider value={lockScroll}>
        <VoiceInput
          sessionId="session-1"
          language="es-ES"
          prompt="Tap and explain it from memory"
          typingPrompt="Type your explanation from memory"
          submitLabel="Send to Pip"
          onSubmit={jest.fn()}
        />
      </ScrollLockContext.Provider>,
    );
    const canvas = await openDrawing();

    await fireEvent(canvas, 'responderGrant', touch(10, 10));
    expect(lockScroll).toHaveBeenLastCalledWith(true);
    await fireEvent(canvas, 'responderRelease', touch(10, 10));
    expect(lockScroll).toHaveBeenLastCalledWith(false);
  });

  it('offers drawing even where voice is not available', async () => {
    mockSpeech({ isAvailable: false });
    await renderInput(jest.fn());

    expect(screen.getByRole('button', { name: 'Draw instead' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Talk instead' })).toBeNull();
  });
});
