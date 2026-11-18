import { useEffect, useState } from 'react';
import { Animated, Platform } from 'react-native';

import { Pip } from '@/components/pip';
import type { PipMood, PipMouth } from '@/components/pip';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

export type PipState = 'idle' | 'speaking' | 'listening' | 'thinking';

// Which drawing each state starts from
const MOOD_FOR_STATE: Record<PipState, PipMood> = {
  idle: 'happy',
  speaking: 'happy',
  listening: 'listening',
  thinking: 'thinking',
};

// Blinks come every 3 to 6 seconds and last as long as a real one
const SHORTEST_BLINK_GAP = 3000;
const BLINK_LENGTH = 130;
// The thinking dots and sound waves light up one after another at this pace
const PULSE_STEP = 400;
// Browsers run these animations in JavaScript; phones hand them to the native side
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type BodyMotion = { kind: 'bob' | 'breathe'; halfCycle: number };

/** How Pip's whole body moves in a state, or null when the person asked for less motion. */
export function bodyMotion(state: PipState, reduceMotion: boolean): BodyMotion | null {
  if (reduceMotion) {
    return null;
  }
  if (state === 'speaking') {
    return { kind: 'bob', halfCycle: 420 };
  }
  if (state === 'listening') {
    return { kind: 'breathe', halfCycle: 1300 };
  }
  return { kind: 'breathe', halfCycle: 1700 };
}

type AnimatedPipProps = {
  state: PipState;
  mouth?: PipMouth;
  size: number;
};

/** Pip that breathes, blinks, bobs while talking, listens and thinks, and keeps still for reduced motion. */
export function AnimatedPip({ state, mouth = 'smile', size }: AnimatedPipProps) {
  const reduceMotion = useReduceMotion();
  const motion = bodyMotion(state, reduceMotion);
  const blinking = useBlink(!reduceMotion && state !== 'listening');
  const pulse = usePulse(!reduceMotion && (state === 'listening' || state === 'thinking'));
  const progress = useLoop(motion);

  let transform;
  if (motion?.kind === 'bob') {
    transform = [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.03] }) },
    ];
  } else {
    transform = [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }];
  }

  return (
    // Grows and bobs from its feet, like the drawings' shadow
    <Animated.View style={{ transform, transformOrigin: '50% 100%' }}>
      <Pip
        mood={MOOD_FOR_STATE[state]}
        size={size}
        mouth={state === 'speaking' ? mouth : undefined}
        blinking={blinking}
        pulse={pulse}
      />
    </Animated.View>
  );
}

/** A value that swings from 0 to 1 and back for as long as there is a motion to play. */
function useLoop(motion: BodyMotion | null): Animated.Value {
  // Made once and kept, so the animation carries on across renders
  const [progress] = useState(() => new Animated.Value(0));
  const halfCycle = motion === null ? 0 : motion.halfCycle;

  useEffect(() => {
    progress.setValue(0);
    if (halfCycle === 0) {
      return;
    }
    const swing = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: halfCycle,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(progress, {
        toValue: 0,
        duration: halfCycle,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    const loop = Animated.loop(swing);
    loop.start();
    return () => loop.stop();
  }, [progress, halfCycle]);

  return progress;
}

/** True for the short moment of each blink, every few seconds while enabled. */
function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      timer = setTimeout(
        () => {
          setBlinking(true);
          timer = setTimeout(() => {
            setBlinking(false);
            scheduleBlink();
          }, BLINK_LENGTH);
        },
        SHORTEST_BLINK_GAP + Math.random() * SHORTEST_BLINK_GAP,
      );
    }
    scheduleBlink();
    return () => {
      clearTimeout(timer);
      // Never leave the eyes shut if the blinking stops mid-blink
      setBlinking(false);
    };
  }, [enabled]);

  return enabled && blinking;
}

/** Counts 0, 1, 2, 0, … at a steady pace while enabled, or null when switched off. */
function usePulse(enabled: boolean): number | null {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % 3);
    }, PULSE_STEP);
    return () => clearInterval(timer);
  }, [enabled]);

  return enabled ? step : null;
}
