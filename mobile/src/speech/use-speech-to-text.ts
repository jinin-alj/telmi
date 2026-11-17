import { EventEmitter, useEventListener } from 'expo';
import type {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionNativeEventMap,
} from 'expo-speech-recognition';
import { useEffect, useState } from 'react';

import type { SpeechLanguage } from '@/speech/languages';
import { speechModule } from '@/speech/speech-module';
import type { SpeechModule } from '@/speech/speech-module';
import { appendPhrase, joinTranscript } from '@/speech/transcript';
import { stopSpeaking } from '@/speech/text-to-speech';

// Never emits anything; lets the event hooks run the same way when speech isn't available
const silentEmitter = new EventEmitter<{
  [EventName in keyof ExpoSpeechRecognitionNativeEventMap]: (
    event: ExpoSpeechRecognitionNativeEventMap[EventName],
  ) => void;
}>();

/** A friendly sentence for each recognition error the student might hit. */
export function describeSpeechError(errorCode: ExpoSpeechRecognitionErrorCode): string | null {
  if (errorCode === 'aborted') {
    return null;
  }
  if (errorCode === 'no-speech') {
    return "I didn't hear anything. Tap the microphone and try again.";
  }
  if (errorCode === 'not-allowed') {
    return 'Microphone access is off. Allow it in your settings, or type instead.';
  }
  if (errorCode === 'network') {
    return 'Speech recognition needs an internet connection here. You can type instead.';
  }
  if (errorCode === 'language-not-supported') {
    return "This device can't recognise that language. Try the other language or type instead.";
  }
  return "Voice isn't working right now. You can type instead.";
}

/** Whether this build, device or browser can recognise speech at all. */
export function isSpeechRecognitionAvailable(module: SpeechModule | null = speechModule): boolean {
  if (module === null) {
    return false;
  }
  try {
    return module.isRecognitionAvailable();
  } catch (error) {
    console.warn('Speech recognition check failed', error);
    return false;
  }
}

// Finished phrases plus the one still being recognised, kept together so updates never race
type Heard = { finished: string; inProgress: string };

const NOTHING_HEARD: Heard = { finished: '', inProgress: '' };

/** Live speech-to-text for one input: start, stop, and the transcript so far. */
export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [heard, setHeard] = useState<Heard>(NOTHING_HEARD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvailable] = useState(isSpeechRecognitionAvailable);
  const eventSource = speechModule ?? silentEmitter;

  useEventListener(eventSource, 'start', () => setIsListening(true));
  useEventListener(eventSource, 'end', () => {
    setIsListening(false);
    // Some browsers stop without a final result; keep the last phrase instead of losing it
    setHeard((previous) => ({
      finished: appendPhrase(previous.finished, previous.inProgress),
      inProgress: '',
    }));
  });
  useEventListener(eventSource, 'result', (event) => {
    const phrase = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setHeard((previous) => ({
        finished: appendPhrase(previous.finished, phrase),
        inProgress: '',
      }));
    } else {
      setHeard((previous) => ({ finished: previous.finished, inProgress: phrase }));
    }
  });
  useEventListener(eventSource, 'error', (event) => {
    setErrorMessage(describeSpeechError(event.error));
  });

  // Stop the microphone if the answer box closes mid-sentence, e.g. when time runs out
  useEffect(() => {
    return () => {
      if (speechModule === null) {
        return;
      }
      try {
        speechModule.abort();
      } catch (error) {
        console.warn('Could not stop speech recognition', error);
      }
    };
  }, []);

  async function startListening(language: SpeechLanguage) {
    setErrorMessage(null);
    if (speechModule === null) {
      setErrorMessage(describeSpeechError('service-not-allowed'));
      return;
    }
    stopSpeaking();
    try {
      const permission = await speechModule.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(describeSpeechError('not-allowed'));
        return;
      }
      // Continuous so a pause to think doesn't cut the student off
      speechModule.start({ lang: language, interimResults: true, continuous: true });
    } catch (error) {
      console.warn('Could not start speech recognition', error);
      setErrorMessage(describeSpeechError('service-not-allowed'));
    }
  }

  function stopListening() {
    if (speechModule === null) {
      return;
    }
    try {
      speechModule.stop();
    } catch (error) {
      console.warn('Could not stop speech recognition', error);
      setIsListening(false);
    }
  }

  function clearTranscript() {
    setHeard(NOTHING_HEARD);
    setErrorMessage(null);
  }

  return {
    isAvailable,
    isListening,
    transcript: joinTranscript(heard.finished, heard.inProgress),
    errorMessage,
    startListening,
    stopListening,
    clearTranscript,
  };
}
