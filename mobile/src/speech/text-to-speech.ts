import * as Speech from 'expo-speech';

import type { SpeechLanguage } from '@/speech/languages';
import { wordAt } from '@/speech/words';

// What the voice reports while it reads, so Pip's mouth can follow along
export type SpeechEvents = {
  onStart: () => void;
  onWord: (word: string) => void;
  onEnd: () => void;
  onError: () => void;
};

/** Read text aloud, cutting off anything still being spoken. */
export function speak(text: string, language: SpeechLanguage, events: SpeechEvents): void {
  Speech.stop();
  Speech.speak(text, {
    language,
    rate: 1.0,
    onStart: events.onStart,
    onBoundary: (event: { charIndex: number; name?: string }) => {
      // Browsers also mark the start of each sentence; only words move the mouth
      if (event.name === undefined || event.name === 'word') {
        events.onWord(wordAt(text, event.charIndex));
      }
    },
    onDone: events.onEnd,
    onStopped: events.onEnd,
    onError: events.onError,
  });
}

/** Stop speaking, for example before the microphone starts so it doesn't hear Pip. */
export function stopSpeaking(): void {
  Speech.stop();
}
