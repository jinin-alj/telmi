import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { finishSession, sendTurn } from '@/api/study';
import type { InputMode, StudySession } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { ErrorMessage } from '@/components/error-message';
import { AnimatedPip } from '@/components/animated-pip';
import type { PipState } from '@/components/animated-pip';
import type { PipMouth } from '@/components/pip';
import { minutesLeft } from '@/features/session/session-time';
import { VoiceInput } from '@/features/session/voice-input';
import { useIsWide } from '@/hooks/use-is-wide';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import type { SpeechLanguage } from '@/speech/languages';
import {
  colors,
  cornerRadius,
  fonts,
  minimumTouchSize,
  panelShadow,
  spacing,
  textStyles,
} from '@/theme';

// Refreshing the countdown every few seconds is enough for a whole-minute display
const CLOCK_TICK_MILLISECONDS = 5000;

type ActiveSessionProps = {
  session: StudySession;
  language: SpeechLanguage;
  onSessionChange: (session: StudySession) => void;
  // Pip's mouth while it reads its line aloud, or null while it is quiet
  pipMouth?: PipMouth | null;
};

/** The conversation: Pip's latest line, the microphone, and the button to finish. */
export function ActiveSession({
  session,
  language,
  onSessionChange,
  pipMouth = null,
}: ActiveSessionProps) {
  const isWide = useIsWide();
  const texts = useTexts();
  const [now, setNow] = useState(Date.now);
  const [showConversation, setShowConversation] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  // A ref rather than state, so a tap on Finish in the same moment already sees it
  const sendingTurn = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MILLISECONDS);
    return () => clearInterval(timer);
  }, []);

  const buddyTurns = session.turns.filter((turn) => turn.speaker === 'buddy');
  const latestBuddyLine = buddyTurns[buddyTurns.length - 1]?.text ?? '';
  const hasExplained = session.turns.some((turn) => turn.speaker === 'student');
  const timeLeft = minutesLeft(session.ends_at, now);
  const canTalk = session.student_turns_left > 0 && timeLeft > 0;

  async function handleSend(text: string, inputMode: InputMode) {
    sendingTurn.current = true;
    try {
      const updated = await sendTurn(session.id, text, inputMode);
      onSessionChange(updated);
    } finally {
      sendingTurn.current = false;
    }
  }

  async function handleFinish() {
    // Finishing while a turn is on its way would grade the session without that turn
    if (sendingTurn.current) {
      return;
    }
    setFinishing(true);
    setFinishError(null);
    try {
      onSessionChange(await finishSession(session.id));
    } catch (error) {
      setFinishError(errorText(error, texts, texts.session.finishFailed));
      setFinishing(false);
    }
  }

  if (finishing) {
    return (
      <View style={styles.checking} accessibilityLiveRegion="polite">
        <AnimatedPip state="thinking" size={120} />
        <ActivityIndicator size="large" color={colors.link} />
        <Text style={styles.checkingText}>{texts.session.checking}</Text>
      </View>
    );
  }

  // Listening wins, so Pip never seems to talk over the student
  let pipState: PipState = 'idle';
  if (listening) {
    pipState = 'listening';
  } else if (pipMouth !== null) {
    pipState = 'speaking';
  }

  // On wide screens Pip's line stays on the left while the student answers on the right
  const pipSide = (
    <>
      <Text style={styles.limits}>
        {texts.session.limits(session.student_turns_left, timeLeft)}
      </Text>

      <View style={styles.pipRow}>
        <AnimatedPip
          state={pipState}
          mouth={pipMouth === null ? undefined : pipMouth}
          size={isWide ? 120 : 72}
        />
        <View style={styles.bubble}>
          <View style={styles.bubbleTail} />
          <Text style={styles.speaker}>{texts.session.pip}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.buddyLine}>
            {latestBuddyLine}
          </Text>
        </View>
      </View>
    </>
  );

  const conversationToggle = showConversation
    ? texts.session.hideConversation
    : texts.session.showConversation;

  const answerSide = (
    <Card>
      {canTalk ? (
        <VoiceInput
          sessionId={session.id}
          language={language}
          prompt={texts.session.talkPrompt}
          typingPrompt={texts.session.typePrompt}
          submitLabel={texts.session.send}
          onSubmit={handleSend}
          onListeningChange={setListening}
        />
      ) : (
        <Text style={styles.limitReached}>
          {timeLeft > 0 ? texts.session.endOfSession : texts.session.timeUp}{' '}
          {texts.session.finishToSee}
        </Text>
      )}

      <ErrorMessage message={finishError} style={styles.error} />

      <View style={styles.finishArea}>
        <Button
          label={texts.session.finish}
          variant={canTalk ? 'secondary' : 'primary'}
          onPress={handleFinish}
          disabled={!hasExplained}
        />
        {!hasExplained ? <Text style={styles.hint}>{texts.session.explainFirst}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={conversationToggle}
        aria-expanded={showConversation}
        onPress={() => setShowConversation(!showConversation)}
        style={styles.toggle}
      >
        <Text style={styles.toggleLabel}>{conversationToggle}</Text>
      </Pressable>

      {showConversation
        ? session.turns.map((turn) => (
            <Text key={turn.position} style={styles.turn}>
              <Text style={styles.turnSpeaker}>
                {turn.speaker === 'buddy' ? texts.session.pip : texts.session.you}:{' '}
              </Text>
              {turn.text}
            </Text>
          ))
        : null}
    </Card>
  );

  return <Columns left={pipSide} right={answerSide} />;
}

const styles = StyleSheet.create({
  limits: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.medium,
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.panel,
    boxShadow: panelShadow,
    borderRadius: cornerRadius,
    padding: spacing.medium,
  },
  // A small turned square on the bubble's edge, pointing at Pip
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 28,
    width: 14,
    height: 14,
    backgroundColor: colors.panel,
    transform: [{ rotate: '45deg' }],
  },
  speaker: {
    ...textStyles.captionStrong,
    color: colors.mutedText,
    marginBottom: 4,
  },
  buddyLine: {
    ...textStyles.pip,
    color: colors.text,
  },
  limitReached: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.medium,
  },
  error: {
    marginTop: spacing.small,
  },
  finishArea: {
    marginTop: spacing.large,
  },
  hint: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 4,
    textAlign: 'center',
  },
  toggle: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  toggleLabel: {
    ...textStyles.body,
    color: colors.link,
    textDecorationLine: 'underline',
  },
  turn: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: spacing.small,
  },
  turnSpeaker: {
    fontFamily: fonts.bodyStrong,
  },
  checking: {
    alignItems: 'center',
    paddingVertical: spacing.large * 2,
  },
  checkingText: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.medium,
    textAlign: 'center',
  },
});
