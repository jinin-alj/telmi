import { useContext, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ApiError } from '@/api/client';
import type { Drawing, PenColor, Point, Stroke } from '@/api/types';
import { Button } from '@/components/button';
import { ScrollLockContext } from '@/components/screen';
import {
  PEN_COLORS,
  PEN_WIDTH,
  clampPoint,
  eraseAt,
  extendStroke,
  hasRoomForMore,
  penValue,
  strokePath,
} from '@/features/session/drawing';
import { colors, minimumTouchSize, spacing } from '@/theme';

const CANVAS_HEIGHT = 240;

type Tool = PenColor | 'eraser';

type DrawingPadProps = {
  // Resolves once the reading is shown; throwing keeps the drawing so the student can retry
  onRead: (drawing: Drawing) => Promise<void>;
};

/** A scratchpad for formulas and working, read into text the student checks before sending. */
export function DrawingPad({ onRead }: DrawingPadProps) {
  const lockScroll = useContext(ScrollLockContext);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>('black');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  // Several moves can arrive before React re-renders, so the live strokes are kept in a ref too
  const size = useRef({ width: 0, height: 0 });
  const strokesRef = useRef<Stroke[]>([]);
  const drawingStroke = useRef(false);

  /** Every change to the strokes goes through here, so the next touch event sees it at once. */
  function updateStrokes(change: (previous: Stroke[]) => Stroke[]) {
    strokesRef.current = change(strokesRef.current);
    setStrokes(strokesRef.current);
  }

  function pointFrom(event: GestureResponderEvent): Point {
    const { locationX, locationY } = event.nativeEvent;
    return clampPoint([locationX, locationY], size.current.width, size.current.height);
  }

  function handleTouchStart(event: GestureResponderEvent) {
    lockScroll(true);
    const point = pointFrom(event);
    if (tool === 'eraser') {
      updateStrokes((previous) => eraseAt(previous, point));
      return;
    }
    if (!hasRoomForMore(strokesRef.current)) {
      return;
    }
    drawingStroke.current = true;
    updateStrokes((previous) => [...previous, { color: tool, points: [point] }]);
  }

  function handleTouchMove(event: GestureResponderEvent) {
    const point = pointFrom(event);
    if (tool === 'eraser') {
      updateStrokes((previous) => eraseAt(previous, point));
      return;
    }
    if (!drawingStroke.current) {
      return;
    }
    updateStrokes((previous) => {
      const last = previous[previous.length - 1];
      return last === undefined ? previous : [...previous.slice(0, -1), extendStroke(last, point)];
    });
  }

  function handleTouchEnd() {
    drawingStroke.current = false;
    lockScroll(false);
  }

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    size.current = { width, height };
  }

  async function handleRead() {
    setReading(true);
    setReadError(null);
    try {
      await onRead({ ...size.current, strokes: strokesRef.current });
      updateStrokes(() => []);
    } catch (error) {
      setReadError(error instanceof ApiError ? error.message : "Couldn't read your drawing.");
    } finally {
      setReading(false);
    }
  }

  const isEmpty = strokes.length === 0;

  return (
    <View>
      <View style={styles.toolbar}>
        {PEN_COLORS.map((pen) => (
          <Pressable
            key={pen.color}
            accessibilityRole="button"
            accessibilityLabel={pen.label}
            accessibilityState={{ selected: tool === pen.color }}
            onPress={() => setTool(pen.color)}
            style={[styles.tool, tool === pen.color ? styles.toolSelected : null]}
          >
            <View style={[styles.swatch, swatchColors[pen.color]]} />
          </Pressable>
        ))}
        <ToolButton label="Eraser" selected={tool === 'eraser'} onPress={() => setTool('eraser')} />
        <ToolButton
          label="Undo"
          disabled={isEmpty}
          onPress={() => updateStrokes((previous) => previous.slice(0, -1))}
        />
        <ToolButton label="Clear" disabled={isEmpty} onPress={() => updateStrokes(() => [])} />
      </View>

      <View
        accessible
        accessibilityLabel="Drawing area"
        accessibilityHint="Write formulas or working with your finger, a pen or the mouse."
        onLayout={handleLayout}
        style={styles.canvas}
        // React Native's touch system: this view claims every touch that starts on it
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Keep the stroke even when the page would like to scroll
        onResponderTerminationRequest={() => false}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        {/* The paths ignore touches, so positions are always measured from the canvas itself */}
        <Svg width="100%" height="100%" pointerEvents="none">
          {strokes.map((stroke, index) => (
            <Path
              key={index}
              d={strokePath(stroke)}
              stroke={penValue(stroke.color)}
              strokeWidth={PEN_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      </View>

      {!hasRoomForMore(strokes) ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          The page is full. Read it, or clear some space.
        </Text>
      ) : null}
      {readError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {readError}
        </Text>
      ) : null}
      <Button label="Read my drawing" onPress={handleRead} loading={reading} disabled={isEmpty} />
    </View>
  );
}

type ToolButtonProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
};

function ToolButton({ label, onPress, selected = false, disabled = false }: ToolButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tool,
        styles.textTool,
        selected ? styles.toolSelected : null,
        disabled ? styles.toolDisabled : null,
      ]}
    >
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

// One fixed style per pen, built once
const swatchColors = StyleSheet.create(
  Object.fromEntries(
    PEN_COLORS.map((pen) => [pen.color, { backgroundColor: pen.value }]),
  ) as Record<PenColor, { backgroundColor: string }>,
);

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  tool: {
    minWidth: minimumTouchSize,
    minHeight: minimumTouchSize,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textTool: {
    paddingHorizontal: spacing.small,
    borderColor: colors.border,
    borderWidth: 1,
  },
  toolSelected: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: colors.primarySoft,
  },
  toolDisabled: {
    opacity: 0.5,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  toolLabel: {
    fontSize: 15,
    color: colors.text,
  },
  canvas: {
    height: CANVAS_HEIGHT,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    overflow: 'hidden',
    // In browsers, stop a finger on the canvas from scrolling or selecting the page
    ...(Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as object) : null),
  },
  note: {
    fontSize: 15,
    color: colors.mutedText,
    marginTop: spacing.small,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginTop: spacing.small,
  },
});
