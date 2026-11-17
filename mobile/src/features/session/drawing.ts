// Pure scratchpad logic, kept apart from the screen so it can be tested without touch events

import type { PenColor, Point, Stroke } from '@/api/types';

// Mirror PEN_COLORS in backend/app/ai/drawing.py. All have at least 4.5:1 contrast on white.
export const PEN_COLORS: { color: PenColor; value: string; label: string }[] = [
  { color: 'black', value: '#111111', label: 'Black pen' },
  { color: 'blue', value: '#1565C0', label: 'Blue pen' },
  { color: 'red', value: '#C62828', label: 'Red pen' },
  { color: 'green', value: '#2E7D32', label: 'Green pen' },
];

// Matches PEN_WIDTH in backend/app/ai/drawing.py
export const PEN_WIDTH = 4;

// Mirror MAX_STROKES and MAX_POINTS in backend/app/schemas/study_sessions.py
export const MAX_STROKES = 400;
export const MAX_POINTS = 20000;

// Closer points add nothing visible and only make the drawing bigger to send
const MIN_POINT_DISTANCE = 2;

// How close the eraser has to come to a line to remove it; roughly a fingertip
export const ERASER_RADIUS = 14;

/** The colour value to draw a pen in. */
export function penValue(color: PenColor): string {
  return PEN_COLORS.find((pen) => pen.color === color)?.value ?? PEN_COLORS[0].value;
}

/** Keep a point inside the canvas, since a finger can drag past its edge. */
export function clampPoint([x, y]: Point, width: number, height: number): Point {
  return [Math.min(Math.max(x, 0), width), Math.min(Math.max(y, 0), height)];
}

/** Add a point to the end of a stroke, skipping it when it's too close to the last one. */
export function extendStroke(stroke: Stroke, point: Point): Stroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && distance(last, point) < MIN_POINT_DISTANCE) {
    return stroke;
  }
  return { ...stroke, points: [...stroke.points, point] };
}

/** Remove every stroke that passes near the point, like rubbing out whole lines. */
export function eraseAt(strokes: Stroke[], point: Point, radius = ERASER_RADIUS): Stroke[] {
  return strokes.filter((stroke) => !strokeNear(stroke, point, radius));
}

/** Total points across the drawing, to stay within what the backend accepts. */
export function countPoints(strokes: Stroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.points.length, 0);
}

/** Whether another stroke can be started without going over the backend's limits. */
export function hasRoomForMore(strokes: Stroke[]): boolean {
  return strokes.length < MAX_STROKES && countPoints(strokes) < MAX_POINTS;
}

/** An SVG path for a stroke; a single tap becomes a dot. */
export function strokePath(stroke: Stroke): string {
  const [first, ...rest] = stroke.points;
  if (first === undefined) {
    return '';
  }
  // A zero-length line with round caps draws as a dot
  const tail = rest.length === 0 ? [first] : rest;
  return `M${first[0]} ${first[1]} ${tail.map(([x, y]) => `L${x} ${y}`).join(' ')}`;
}

/** Add text read from a drawing after what the student already has, on a new line. */
export function appendReading(current: string, reading: string): string {
  const existing = current.trimEnd();
  return existing === '' ? reading : `${existing}\n${reading}`;
}

function distance([x1, y1]: Point, [x2, y2]: Point): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function strokeNear(stroke: Stroke, point: Point, radius: number): boolean {
  if (stroke.points.length === 1) {
    return distance(stroke.points[0], point) <= radius;
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= radius) {
      return true;
    }
  }
  return false;
}

/** Shortest distance from a point to a line segment, so erasing works between sampled points. */
function distanceToSegment(point: Point, start: Point, end: Point): number {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
  if (lengthSquared === 0) {
    return distance(point, start);
  }
  const along = Math.max(
    0,
    Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSquared),
  );
  return distance(point, [ax + along * (bx - ax), ay + along * (by - ay)]);
}
