import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { finishSession, sendTurn } from '@/api/study';
import type { StudySession } from '@/api/types';
import { Button } from '@/components/button';
import { minutesLeft } from '@/features/session/session-time';
import { VoiceInput } from '@/features/session/voice-input';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, minimumTouchSize, spacing } from '@/theme';

// Refreshing the countdown every few seconds is enough for a whole-minute display
const CLOCK_TICK_MILLISECONDS = 5000;

type ActiveSessionProps = {
  session: StudySession;
  language: SpeechLanguage;
  onSessionChange: (session: StudySession) => void;
};

/** The conversation: Pip's latest line, the microphone, and the button to finish. */
export function ActiveSession({ session, language, onSessionChange }: ActiveSessionProps) {
  const [now, setNow] = useState(Date.now);
  const [showConversation, setShowConversation] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MILLISECONDS);
    return () => clearInterval(timer);
  }, []);

  const buddyTurns = session.turns.filter((turn) => turn.speaker === 'buddy');
  const latestBuddyLine = buddyTurns[buddyTurns.length - 1]?.text ?? '';
  const hasExplained = session.turns.some((turn) => turn.speaker === 'student');
  const timeLeft = minutesLeft(session.ends_at, now);
  const canTalk = session.student_turns_left > 0 && timeLeft > 0;

  async function handleSend(text: string) {
    const updated = await sendTurn(session.id, text);
    onSessionChange(updated);
  }

  async function handleFinish() {
    setFinishing(true);
    setFinishError(null);
    try {
      onSessionChange(await finishSession(session.id));
    } catch (error) {
      setFinishError(error instanceof ApiError ? error.message : 'Could not check your answer.');
      setFinishing(false);
    }
  }

  if (finishing) {
    return (
      <View style={styles.checking} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.checkingText}>
          Checking your explanation against your teacher&apos;s notes…
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.limits}>
        {session.student_turns_left} turns left · {timeLeft} min left
      </Text>

      <View style={styles.bubble}>
        <Text style={styles.speaker}>Pip</Text>
        <Text accessibilityLiveRegion="polite" style={styles.buddyLine}>
          {latestBuddyLine}
        </Text>
      </View>

      {canTalk ? (
        <VoiceInput
          sessionId={session.id}
          language={language}
          prompt="Tap and explain it from memory"
          typingPrompt="Type your explanation from memory"
          submitLabel="Send to Pip"
          onSubmit={handleSend}
        />
      ) : (
        <Text style={styles.limitReached}>
          That&apos;s the end of this session. Finish to see what you explained well.
        </Text>
      )}

      {finishError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {finishError}
        </Text>
      ) : null}

      <View style={styles.finishArea}>
        <Button
          label="I'm done, check my explanation"
          variant={canTalk ? 'secondary' : 'primary'}
          onPress={handleFinish}
          disabled={!hasExplained}
        />
        {!hasExplained ? <Text style={styles.hint}>Explain something to Pip first.</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show conversation"
        accessibilityState={{ expanded: showConversation }}
        onPress={() => setShowConversation(!showConversation)}
        style={styles.toggle}
      >
        <Text style={styles.toggleLabel}>
          {showConversation ? 'Hide conversation' : 'Show conversation'}
        </Text>
      </Pressable>

      {showConversation
        ? session.turns.map((turn) => (
            <Text key={turn.position} style={styles.turn}>
              <Text style={styles.turnSpeaker}>{turn.speaker === 'buddy' ? 'Pip' : 'You'}: </Text>
              {turn.text}
            </Text>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  limits: {
    fontSize: 15,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  bubble: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.medium,
  },
  speaker: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  buddyLine: {
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
  },
  limitReached: {
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.medium,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginTop: spacing.small,
  },
  finishArea: {
    marginTop: spacing.large,
  },
  hint: {
    fontSize: 14,
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
    color: colors.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  turn: {
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.small,
  },
  turnSpeaker: {
    fontWeight: '700',
  },
  checking: {
    alignItems: 'center',
    paddingVertical: spacing.large * 2,
  },
  checkingText: {
    fontSize: 17,
    color: colors.text,
    marginTop: spacing.medium,
    textAlign: 'center',
  },
});
