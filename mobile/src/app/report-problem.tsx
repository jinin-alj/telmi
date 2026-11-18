import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { sendFeedback } from '@/api/feedback';
import { BackToHome, goHome } from '@/components/back-to-home';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { Pip } from '@/components/pip';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

// Matches FEEDBACK_MAX_CHARACTERS in backend/app/schemas/feedback.py
const MAX_CHARACTERS = 1000;

export default function ReportProblemScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const texts = useTexts();
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (message.trim() === '') {
      setMessageError(texts.reportProblem.missing);
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
      setFormError(errorText(error, texts, texts.reportProblem.sendFailed));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Screen topBar>
        <Pip mood="proud" size={96} />
        <Text accessibilityRole="header" style={styles.title}>
          {texts.reportProblem.thanks}
        </Text>
        <Text style={styles.body}>{texts.reportProblem.thanksBody}</Text>
        <Button label={texts.reportProblem.back} onPress={goHome} />
      </Screen>
    );
  }

  return (
    <Screen topBar>
      <BackToHome />
      <Text accessibilityRole="header" style={styles.title}>
        {texts.reportProblem.title}
      </Text>
      <TextField
        label={texts.reportProblem.label}
        hint={texts.reportProblem.hint}
        error={messageError}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={MAX_CHARACTERS}
        style={styles.message}
      />
      <ErrorMessage message={formError} style={styles.error} />
      <Button label={texts.reportProblem.send} onPress={handleSend} loading={sending} />
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
