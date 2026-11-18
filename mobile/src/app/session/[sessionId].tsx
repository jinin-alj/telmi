import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { changeSessionLanguage, getSession } from '@/api/study';
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
import { greetingCanChange, lineToSpeak } from '@/features/session/session-text';
import { errorText } from '@/i18n/error-text';
import { useLanguage, useTexts } from '@/i18n/language-context';
import { speechLanguageFor } from '@/speech/languages';
import { colors, spacing, textStyles } from '@/theme';

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<StudySession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const texts = useTexts();
  const { language: appLanguage } = useLanguage();
  // Pip's voice and the microphone always use the language the app is shown in
  const language = speechLanguageFor(appLanguage);
  const [voiceOn, setVoiceOn] = useState(true);
  const isWide = useIsWide();
  const pipVoice = usePipVoice();

  // Runs again when the language changes, so Pip can greet again in it
  useEffect(() => {
    // A slower answer for an earlier language must not overwrite a newer one
    let current = true;
    async function loadSession() {
      try {
        let loaded = await getSession(sessionId);
        if (greetingCanChange(loaded)) {
          loaded = await changeSessionLanguage(loaded.id, appLanguage);
        }
        if (current) {
          setSession(loaded);
        }
      } catch (error) {
        if (current) {
          setLoadError(errorText(error, texts, texts.session.openFailed));
        }
      }
    }
    loadSession();
    return () => {
      current = false;
    };
  }, [sessionId, appLanguage, texts]);

  // Speak each new buddy line, and the summary once the session is checked
  const spokenLine = session === null ? '' : lineToSpeak(session, texts.results);
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
      {session === null && loadError === null ? <Loading label={texts.session.opening} /> : null}

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
            <SessionSettings voiceOn={voiceOn} onVoiceChange={handleVoiceChange} />
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
