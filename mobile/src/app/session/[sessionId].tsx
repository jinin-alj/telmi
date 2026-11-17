import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api/client';
import { getSession } from '@/api/study';
import type { StudySession } from '@/api/types';
import { BackToHome } from '@/components/back-to-home';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { ActiveSession } from '@/features/session/active-session';
import { SessionResults } from '@/features/session/session-results';
import { SessionSettings } from '@/features/session/session-settings';
import { lineToSpeak } from '@/features/session/session-text';
import { getDefaultSpeechLanguage } from '@/speech/languages';
import type { SpeechLanguage } from '@/speech/languages';
import { speak, stopSpeaking } from '@/speech/text-to-speech';
import { colors, spacing } from '@/theme';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<StudySession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SpeechLanguage>(getDefaultSpeechLanguage);
  const [voiceOn, setVoiceOn] = useState(true);

  useEffect(() => {
    getSession(sessionId)
      .then(setSession)
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : 'Could not open this session.');
      });
  }, [sessionId]);

  // Speak each new buddy line, and the summary once the session is checked
  const spokenLine = session === null ? '' : lineToSpeak(session);
  // Remembered so changing the language or voice setting never repeats a line already heard
  const lastLine = useRef('');
  useEffect(() => {
    if (spokenLine === '' || spokenLine === lastLine.current) {
      return;
    }
    lastLine.current = spokenLine;
    if (voiceOn) {
      speak(spokenLine, language);
    }
  }, [spokenLine, voiceOn, language]);

  // Never keep talking after the student leaves the screen
  useEffect(() => stopSpeaking, []);

  function handleVoiceChange(nextVoiceOn: boolean) {
    setVoiceOn(nextVoiceOn);
    if (!nextVoiceOn) {
      stopSpeaking();
    }
  }

  return (
    <Screen>
      <BackToHome />

      {loadError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {loadError}
        </Text>
      ) : null}
      {session === null && loadError === null ? <Loading label="Opening your session" /> : null}

      {session !== null ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {session.unit_title}
          </Text>
          {session.status === 'active' ? (
            <ActiveSession session={session} language={language} onSessionChange={setSession} />
          ) : (
            <SessionResults session={session} language={language} onSessionChange={setSession} />
          )}
          <SessionSettings
            language={language}
            onLanguageChange={setLanguage}
            voiceOn={voiceOn}
            onVoiceChange={handleVoiceChange}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.small,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginVertical: spacing.medium,
  },
});
