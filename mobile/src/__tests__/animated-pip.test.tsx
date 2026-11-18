import { act, render, screen } from '@testing-library/react-native';

import { AnimatedPip, bodyMotion } from '@/components/animated-pip';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

jest.mock('@/hooks/use-reduce-motion', () => ({ useReduceMotion: jest.fn() }));

// Pip is hidden from screen readers, so queries have to ask for hidden elements
const HIDDEN = { includeHiddenElements: true };

/** Steps through time and says whether Pip blinked at any point. */
async function blinkedWithin(milliseconds: number): Promise<boolean> {
  let blinked = false;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    if (screen.queryByTestId('pip-blink', HIDDEN) !== null) {
      blinked = true;
    }
  }
  return blinked;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(useReduceMotion).mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

it.each([
  ['idle', 'pip-happy'],
  ['speaking', 'pip-happy'],
  ['listening', 'pip-listening'],
  ['thinking', 'pip-thinking'],
] as const)('draws Pip %s', async (state, drawing) => {
  await render(<AnimatedPip state={state} size={96} />);

  expect(screen.getByTestId(drawing, HIDDEN)).toBeTruthy();
});

it('shows the mouth shape for the word being said', async () => {
  await render(<AnimatedPip state="speaking" mouth="wide" size={96} />);

  expect(screen.getByTestId('pip-mouth-wide', HIDDEN)).toBeTruthy();
});

it('blinks every few seconds', async () => {
  await render(<AnimatedPip state="idle" size={96} />);

  expect(await blinkedWithin(6500)).toBe(true);
});

it('does not blink while listening with its eyes closed', async () => {
  await render(<AnimatedPip state="listening" size={96} />);

  expect(await blinkedWithin(6500)).toBe(false);
});

it('pulses the thinking dots one after another', async () => {
  await render(<AnimatedPip state="thinking" size={96} />);
  expect(screen.getByTestId('pip-pulse-0', HIDDEN)).toBeTruthy();

  await act(async () => {
    jest.advanceTimersByTime(500);
  });

  expect(screen.getByTestId('pip-pulse-1', HIDDEN)).toBeTruthy();
});

it('keeps still when the system asks for reduced motion', async () => {
  jest.mocked(useReduceMotion).mockReturnValue(true);
  await render(<AnimatedPip state="thinking" size={96} />);

  expect(await blinkedWithin(6500)).toBe(false);
  expect(screen.queryByTestId('pip-pulse-0', HIDDEN)).toBeNull();
  expect(bodyMotion('thinking', true)).toBeNull();
});

it('bobs while talking and breathes otherwise', () => {
  expect(bodyMotion('speaking', false)?.kind).toBe('bob');
  expect(bodyMotion('idle', false)?.kind).toBe('breathe');
  expect(bodyMotion('listening', false)?.kind).toBe('breathe');
});
