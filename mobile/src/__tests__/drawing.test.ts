import type { Stroke } from '@/api/types';
import {
  MAX_POINTS,
  MAX_STROKES,
  appendReading,
  clampPoint,
  countPoints,
  eraseAt,
  extendStroke,
  hasRoomForMore,
  penValue,
  strokePath,
} from '@/features/session/drawing';

const LINE: Stroke = {
  color: 'black',
  points: [
    [0, 0],
    [100, 0],
  ],
};

describe('extendStroke', () => {
  it('adds points far enough from the last one', () => {
    expect(extendStroke(LINE, [100, 10]).points).toHaveLength(3);
  });

  it('skips points that would add nothing visible', () => {
    expect(extendStroke(LINE, [100, 1])).toBe(LINE);
  });
});

describe('eraseAt', () => {
  it('removes a line touched between its sampled points', () => {
    expect(eraseAt([LINE], [50, 5])).toEqual([]);
  });

  it('keeps lines the eraser does not reach', () => {
    expect(eraseAt([LINE], [50, 40])).toEqual([LINE]);
  });

  it('removes a single dot', () => {
    expect(eraseAt([{ color: 'red', points: [[10, 10]] }], [12, 12])).toEqual([]);
  });
});

describe('clampPoint', () => {
  it('keeps a dragged finger inside the canvas', () => {
    expect(clampPoint([-5, 500], 300, 240)).toEqual([0, 240]);
  });
});

describe('hasRoomForMore', () => {
  it('stops new strokes at the backend limits', () => {
    const dot: Stroke = { color: 'black', points: [[1, 1]] };
    expect(hasRoomForMore(Array(MAX_STROKES - 1).fill(dot))).toBe(true);
    expect(hasRoomForMore(Array(MAX_STROKES).fill(dot))).toBe(false);

    const long: Stroke = { color: 'black', points: Array(MAX_POINTS).fill([1, 1]) };
    expect(countPoints([long])).toBe(MAX_POINTS);
    expect(hasRoomForMore([long])).toBe(false);
  });
});

describe('strokePath', () => {
  it('draws a line through every point', () => {
    expect(strokePath(LINE)).toBe('M0 0 L100 0');
  });

  it('draws a tap as a dot', () => {
    expect(strokePath({ color: 'black', points: [[5, 6]] })).toBe('M5 6 L5 6');
  });
});

describe('appendReading', () => {
  it('starts with the reading when there is no text yet', () => {
    expect(appendReading('  ', 'x² = 4')).toBe('x² = 4');
  });

  it('adds the reading on a new line', () => {
    expect(appendReading('First I square it\n', 'x² = 4')).toBe('First I square it\nx² = 4');
  });
});

describe('penValue', () => {
  it('gives each pen its colour', () => {
    expect(penValue('red')).toBe('#C62828');
  });
});
