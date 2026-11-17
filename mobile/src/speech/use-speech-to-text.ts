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

/** Live speech-to-text for one input: start, stop, and the transcript so far. */
export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [finishedText, setFinishedText] = useState('');
  const [inProgressText, setInProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvailable] = useState(isSpeechRecognitionAvailable);
  const eventSource = speechModule ?? silentEmitter;

  useEventListener(eventSource, 'start', () => setIsListening(true));
  useEventListener(eventSource, 'end', () => {
    setIsListening(false);
    setInProgressText('');
  });
  useEventListener(eventSource, 'result', (event) => {
    const phrase = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setFinishedText((previous) => appendPhrase(previous, phrase));
      setInProgressText('');
    } else {
      setInProgressText(phrase);
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
    setFinishedText('');
    setInProgressText('');
    setErrorMessage(null);
  }

  return {
    isAvailable,
    isListening,
    transcript: joinTranscript(finishedText, inProgressText),
    errorMessage,
    startListening,
    stopListening,
    clearTranscript,
  };
}
