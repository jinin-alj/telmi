import { useEffect, useRef, useState } from 'react';

import type { PipMouth } from '@/components/pip';
import { mouthForWord, mouthOpenTime, wordGap } from '@/features/session/pip-talk';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { SpeechLanguage } from '@/speech/languages';
import { speak, stopSpeaking } from '@/speech/text-to-speech';

// Some voices never say which word they are on; after this long, Pip talks to its own rhythm
const WORD_EVENT_WAIT = 450;
// With the voice off, Pip only mouths the start of a new line
const WORDS_WITHOUT_VOICE = 6;
// A short pause after the last word before Pip rests
const LAST_WORD_PAUSE = 250;

type Timer = ReturnType<typeof setTimeout>;

/** Reads Pip's lines aloud and gives the mouth shape right now, or null while Pip is quiet. */
export function usePipVoice() {
  const reduceMotion = useReduceMotion();
  const [mouth, setMouth] = useState<PipMouth | null>(null);
  // Every pending timer for the current line, kept in one array so they can all be cancelled
  const timers = useRef<Timer[]>([]);
  const closeMouthTimer = useRef<Timer | null>(null);
  // Each line gets a number, so events from a line that was cut off are ignored
  const lineNumber = useRef(0);
  const heardWord = useRef(false);

  // Never keep talking after the student leaves the screen
  useEffect(() => {
    const pendingTimers = timers.current;
    const currentLine = lineNumber;
    return () => {
      currentLine.current += 1;
      for (const timer of pendingTimers) {
        clearTimeout(timer);
      }
      stopSpeaking();
    };
  }, []);

  function clearTimers() {
    for (const timer of timers.current) {
      clearTimeout(timer);
    }
    timers.current.length = 0;
    if (closeMouthTimer.current !== null) {
      clearTimeout(closeMouthTimer.current);
    }
  }

  function sayWord(word: string, line: number) {
    if (line !== lineNumber.current) {
      return;
    }
    // Reduced motion keeps the mouth open while Pip talks, without opening and closing
    if (reduceMotion) {
      setMouth('small');
      return;
    }
    setMouth(mouthForWord(word));
    if (closeMouthTimer.current !== null) {
      clearTimeout(closeMouthTimer.current);
    }
    closeMouthTimer.current = setTimeout(() => {
      if (line === lineNumber.current) {
        setMouth('smile');
      }
    }, mouthOpenTime(word));
  }

  function finish(line: number) {
    if (line !== lineNumber.current) {
      return;
    }
    clearTimers();
    setMouth(null);
  }

  /** Mouths words one after another without a voice; returns when the last one ends. */
  function talkToRhythm(text: string, line: number, wordLimit: number): number {
    const words = text.split(' ').slice(0, wordLimit);
    let time = 0;
    for (const word of words) {
      if (time === 0) {
        sayWord(word, line);
      } else {
        timers.current.push(setTimeout(() => sayWord(word, line), time));
      }
      time += wordGap(word);
    }
    return time;
  }

  /** Starts a new line, cancelling whatever Pip was saying; returns the line's number. */
  function startLine(): number {
    lineNumber.current += 1;
    clearTimers();
    heardWord.current = false;
    return lineNumber.current;
  }

  function speakLine(text: string, language: SpeechLanguage) {
    const line = startLine();
    setMouth('smile');
    speak(text, language, {
      onStart: () => {
        timers.current.push(
          setTimeout(() => {
            if (line === lineNumber.current && !heardWord.current) {
              talkToRhythm(text, line, Infinity);
            }
          }, WORD_EVENT_WAIT),
        );
      },
      onWord: (word) => {
        heardWord.current = true;
        sayWord(word, line);
      },
      onEnd: () => finish(line),
      // If the voice fails, Pip still mouths the line so the student sees it was said
      onError: () => {
        const duration = talkToRhythm(text, line, Infinity);
        timers.current.push(setTimeout(() => finish(line), duration + LAST_WORD_PAUSE));
      },
    });
  }

  /** With the voice off, Pip mouths the start of a new line for a moment, then rests. */
  function mumble(text: string) {
    const line = startLine();
    const duration = talkToRhythm(text, line, WORDS_WITHOUT_VOICE);
    timers.current.push(setTimeout(() => finish(line), duration + LAST_WORD_PAUSE));
  }

  function stop() {
    startLine();
    stopSpeaking();
    setMouth(null);
  }

  return { mouth, speakLine, mumble, stop };
}
