import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api/client';
import { sendFeedback } from '@/api/feedback';
import { BackToHome, goHome } from '@/components/back-to-home';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { Pip } from '@/components/pip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { colors, spacing, textStyles } from '@/theme';

// Matches FEEDBACK_MAX_CHARACTERS in backend/app/schemas/feedback.py
const MAX_CHARACTERS = 1000;

export default function ReportProblemScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (message.trim() === '') {
      setMessageError('Say what went wrong first.');
      return;
    }
    setMessageError(null);
    setFormError(null);
    setSending(true);
    try {
      await sendFeedback({
        message: message.trim(),
        page: from ?? '',
        app_version: Constants.expoConfig?.version ?? '',
      });
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'That did not send. Try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Screen topBar>
        <Pip mood="proud" size={96} />
        <Text accessibilityRole="header" style={styles.title}>
          Thanks for telling us
        </Text>
        <Text style={styles.body}>
          The Telmi team reads every report and uses it to fix things.
        </Text>
        <Button label="Back to my classes" onPress={goHome} />
      </Screen>
    );
  }

  return (
    <Screen topBar>
      <BackToHome />
      <Text accessibilityRole="header" style={styles.title}>
        Report a problem
      </Text>
      <TextField
        label="What went wrong?"
        hint="Say what you were doing and what happened. Please don't include anyone's personal details."
        error={messageError}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={MAX_CHARACTERS}
        style={styles.message}
      />
      <ErrorMessage message={formError} style={styles.error} />
      <Button label="Send report" onPress={handleSend} loading={sending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...textStyles.title,
    color: colors.text,
    marginBottom: spacing.medium,
  },
  body: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: spacing.large,
  },
  message: {
    minHeight: 140,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.small,
  },
});
