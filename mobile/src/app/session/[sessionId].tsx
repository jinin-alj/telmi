import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getSession } from '@/api/study';
import type { StudySession } from '@/api/types';
import { BackToHome } from '@/components/back-to-home';
import { ErrorMessage } from '@/components/error-message';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { ActiveSession } from '@/features/session/active-session';
import { SessionResults } from '@/features/session/session-results';
import { SessionSettings } from '@/features/session/session-settings';
import { usePipVoice } from '@/features/session/use-pip-voice';
import { useIsWide } from '@/hooks/use-is-wide';
import { lineToSpeak } from '@/features/session/session-text';
import { getDefaultSpeechLanguage } from '@/speech/languages';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, spacing, textStyles } from '@/theme';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<StudySession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SpeechLanguage>(getDefaultSpeechLanguage);
  const [voiceOn, setVoiceOn] = useState(true);
  const isWide = useIsWide();
  const pipVoice = usePipVoice();

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
      pipVoice.speakLine(spokenLine, language);
    } else {
      pipVoice.mumble(spokenLine);
    }
  }, [spokenLine, voiceOn, language, pipVoice]);

  function handleVoiceChange(nextVoiceOn: boolean) {
    setVoiceOn(nextVoiceOn);
    if (!nextVoiceOn) {
      pipVoice.stop();
    }
  }

  return (
    <Screen width="wide" topBar>
      <BackToHome />

      <ErrorMessage message={loadError} style={styles.error} />
      {session === null && loadError === null ? <Loading label="Opening your session" /> : null}

      {session !== null ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {session.unit_title}
          </Text>
          {session.status === 'active' ? (
            <ActiveSession
              session={session}
              language={language}
              onSessionChange={setSession}
              pipMouth={pipVoice.mouth}
            />
          ) : (
            <SessionResults session={session} language={language} onSessionChange={setSession} />
          )}
          {/* Under Pip's column on wide screens, instead of stretching across the page */}
          <View style={isWide ? styles.settingsWide : null}>
            <SessionSettings
              language={language}
              onLanguageChange={setLanguage}
              voiceOn={voiceOn}
              onVoiceChange={handleVoiceChange}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...textStyles.title,
    color: colors.text,
    marginBottom: spacing.small,
  },
  error: {
    marginVertical: spacing.medium,
  },
  settingsWide: {
    width: '50%',
    paddingRight: spacing.large / 2,
  },
});
