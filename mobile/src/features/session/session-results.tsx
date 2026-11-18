import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { answerApplicationQuestion, startSession } from '@/api/study';
import type { ApplicationResult, StudySession } from '@/api/types';
import { goHome } from '@/components/back-to-home';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { ErrorMessage } from '@/components/error-message';
import { Pip } from '@/components/pip';
import { summariseCoverage } from '@/features/session/session-text';
import { VoiceInput } from '@/features/session/voice-input';
import { useIsWide } from '@/hooks/use-is-wide';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, cornerRadius, spacing, textStyles } from '@/theme';

const VERDICT_LABELS: Record<ApplicationResult['verdict'], string> = {
  correct: 'Correct',
  partly_correct: 'Partly correct',
  incorrect: 'Not quite',
};

type SessionResultsProps = {
  session: StudySession;
  language: SpeechLanguage;
  onSessionChange: (session: StudySession) => void;
};

/** What the student explained, what to fix, the next step and the exam-style question. */
export function SessionResults({ session, language, onSessionChange }: SessionResultsProps) {
  const isWide = useIsWide();
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const feedback = session.feedback;
  if (feedback === null) {
    return null;
  }

  async function handleAnswer(text: string) {
    onSessionChange(await answerApplicationQuestion(session.id, text));
  }

  async function handleTryAgain() {
    setRestarting(true);
    setRestartError(null);
    try {
      const newSession = await startSession(session.unit_id);
      router.replace({ pathname: '/session/[sessionId]', params: { sessionId: newSession.id } });
    } catch (error) {
      setRestartError(error instanceof ApiError ? error.message : 'Could not start a new session.');
      setRestarting(false);
    }
  }

  // What went well and what to fix on the left; what to do next on the right
  const resultSide = (
    <Card>
      <View style={styles.summaryRow}>
        <Pip mood="surprised" size={72} />
        <Text accessibilityRole="header" style={styles.summary}>
          {summariseCoverage(feedback)}
        </Text>
      </View>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Key ideas
      </Text>
      {/* Keys by position, since the checker can repeat the same text */}
      {feedback.key_ideas.map((keyIdea, index) => {
        const covered = keyIdea.status === 'covered';
        return (
          <View
            key={index}
            style={[styles.idea, covered ? styles.ideaCovered : styles.ideaMissing]}
          >
            <Text style={[styles.ideaStatus, covered ? styles.coveredText : null]}>
              {covered ? '✓ Explained' : 'Still to explain'}
            </Text>
            <Text style={styles.ideaText}>{keyIdea.idea}</Text>
          </View>
        );
      })}

      {feedback.misconceptions.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Things to fix
          </Text>
          {feedback.misconceptions.map((misconception, index) => (
            <View key={index} style={styles.fix}>
              <Text style={styles.fixLabel}>You said</Text>
              <Text style={styles.fixText}>{misconception.student_said}</Text>
              <Text style={styles.fixLabel}>Actually</Text>
              <Text style={styles.fixText}>{misconception.correction}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Card>
  );

  const nextSide = (
    <Card>
      {/* At the top of its own card on wide screens, so it needs no space above */}
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, isWide ? styles.noSpaceAbove : null]}
      >
        Your next step
      </Text>
      <Text style={styles.body}>{feedback.next_step}</Text>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Try this exam question
      </Text>
      <Text style={styles.question}>{feedback.application_question}</Text>

      {session.application_result === null ? (
        <VoiceInput
          sessionId={session.id}
          language={language}
          prompt="Tap and answer out loud"
          typingPrompt="Type your answer"
          submitLabel="Check my answer"
          onSubmit={handleAnswer}
        />
      ) : (
        <View style={styles.answer}>
          <Text style={styles.fixLabel}>Your answer</Text>
          <Text style={styles.fixText}>{session.application_answer}</Text>
          <Text style={styles.verdict}>{VERDICT_LABELS[session.application_result.verdict]}</Text>
          <Text style={styles.body}>{session.application_result.explanation}</Text>
        </View>
      )}

      <ErrorMessage message={restartError} style={styles.error} />
      <View style={styles.actions}>
        <Button label="Explain it again" onPress={handleTryAgain} loading={restarting} />
        <Button label="Back to my classes" variant="secondary" onPress={goHome} />
      </View>
    </Card>
  );

  return <Columns left={resultSide} right={nextSide} />;
}

const styles = StyleSheet.create({
  // The one thing to remember on this screen, so it gets the brand's emphasis colour
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
  },
  summary: {
    ...textStyles.section,
    flex: 1,
    color: colors.emphasis,
  },
  sectionTitle: {
    ...textStyles.section,
    color: colors.text,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  noSpaceAbove: {
    marginTop: 0,
  },
  idea: {
    borderRadius: cornerRadius,
    padding: 12,
    marginBottom: spacing.small,
  },
  ideaCovered: {
    backgroundColor: colors.dataSoft,
  },
  ideaMissing: {
    backgroundColor: colors.warningSoft,
  },
  ideaStatus: {
    ...textStyles.captionStrong,
    color: colors.text,
  },
  coveredText: {
    color: colors.data,
  },
  ideaText: {
    ...textStyles.body,
    color: colors.text,
    marginTop: 2,
  },
  // Mistakes sit on a calm peach panel: Pip never marks anything in red
  fix: {
    backgroundColor: colors.primarySoft,
    borderRadius: cornerRadius,
    padding: 12,
    marginBottom: spacing.small,
  },
  fixLabel: {
    ...textStyles.captionStrong,
    color: colors.mutedText,
  },
  fixText: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    ...textStyles.body,
    color: colors.text,
  },
  question: {
    ...textStyles.body,
    color: colors.text,
  },
  answer: {
    marginTop: spacing.medium,
  },
  verdict: {
    ...textStyles.section,
    color: colors.data,
    marginVertical: spacing.small,
  },
  error: {
    marginTop: spacing.medium,
  },
  actions: {
    marginTop: spacing.large,
  },
});
