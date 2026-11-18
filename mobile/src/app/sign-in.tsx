import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { normalizeUsername } from '@/auth/validation';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { Screen } from '@/components/screen';
import { SlowRequestNotice } from '@/components/slow-request-notice';
import { TextField } from '@/components/text-field';
import { Wordmark } from '@/components/wordmark';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, minimumTouchSize, spacing, textStyles } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const texts = useTexts();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (username.trim() === '' || password === '') {
      setFormError(texts.signIn.missingFields);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await signIn(normalizeUsername(username), password);
    } catch (error) {
      setFormError(errorText(error, texts, texts.signIn.failed));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View accessible accessibilityRole="header" accessibilityLabel="Telmi">
        <Wordmark size="large" mood="wave" />
      </View>
      <Text style={styles.subtitle}>{texts.signIn.tagline}</Text>

      <TextField
        label={texts.signIn.username}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
      />
      <TextField
        label={texts.signIn.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />

      <ErrorMessage message={formError} style={styles.formError} />

      <Button label={texts.signIn.submit} onPress={handleSubmit} loading={submitting} />
      <SlowRequestNotice waiting={submitting} />

      <Link href="/sign-up" style={styles.link}>
        {texts.signIn.toSignUp}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...textStyles.body,
    color: colors.mutedText,
    marginTop: spacing.small,
    marginBottom: spacing.large,
  },
  formError: {
    marginBottom: spacing.small,
  },
  link: {
    ...textStyles.body,
    color: colors.link,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: spacing.medium,
    paddingVertical: (minimumTouchSize - 20) / 2,
  },
});
