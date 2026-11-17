import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { answerApplicationQuestion, startSession } from '@/api/study';
import type { ApplicationResult, StudySession } from '@/api/types';
import { Button } from '@/components/button';
import { summariseCoverage } from '@/features/session/session-text';
import { VoiceInput } from '@/features/session/voice-input';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, spacing } from '@/theme';

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

  return (
    <View>
      <Text accessibilityRole="header" style={styles.summary}>
        {summariseCoverage(feedback)}
      </Text>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Key ideas
      </Text>
      {feedback.key_ideas.map((keyIdea) => {
        const covered = keyIdea.status === 'covered';
        return (
          <View
            key={keyIdea.idea}
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
          {feedback.misconceptions.map((misconception) => (
            <View key={misconception.student_said} style={styles.fix}>
              <Text style={styles.fixLabel}>You said</Text>
              <Text style={styles.fixText}>{misconception.student_said}</Text>
              <Text style={styles.fixLabel}>Actually</Text>
              <Text style={styles.fixText}>{misconception.correction}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text accessibilityRole="header" style={styles.sectionTitle}>
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

      {restartError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {restartError}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Explain it again" onPress={handleTryAgain} loading={restarting} />
        <Button
          label="Back to my classes"
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  idea: {
    borderRadius: 8,
    padding: 12,
    marginBottom: spacing.small,
  },
  ideaCovered: {
    backgroundColor: colors.successSoft,
  },
  ideaMissing: {
    backgroundColor: colors.warningSoft,
  },
  ideaStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  coveredText: {
    color: colors.success,
  },
  ideaText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 2,
  },
  fix: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    paddingLeft: 12,
    marginBottom: spacing.medium,
  },
  fixLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.mutedText,
  },
  fixText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: 16,
    color: colors.text,
  },
  question: {
    fontSize: 18,
    color: colors.text,
  },
  answer: {
    marginTop: spacing.medium,
  },
  verdict: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginVertical: spacing.small,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginTop: spacing.medium,
  },
  actions: {
    marginTop: spacing.large,
  },
});
