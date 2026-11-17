import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { normalizeUsername } from '@/auth/validation';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SlowRequestNotice } from '@/components/slow-request-notice';
import { TextField } from '@/components/text-field';
import { colors, minimumTouchSize, spacing } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (username.trim() === '' || password === '') {
      setFormError('Enter your username and password.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await signIn(normalizeUsername(username), password);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Telmi
      </Text>
      <Text style={styles.subtitle}>Explain it from memory. Your buddy is the one learning.</Text>

      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />

      {formError ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.formError}>
          {formError}
        </Text>
      ) : null}

      <Button label="Sign in" onPress={handleSubmit} loading={submitting} />
      <SlowRequestNotice waiting={submitting} />

      <Link href="/sign-up" style={styles.link}>
        New here? Create an account
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.small,
    marginBottom: spacing.large,
  },
  formError: {
    color: colors.error,
    fontSize: 15,
    marginBottom: spacing.small,
  },
  link: {
    color: colors.link,
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: spacing.medium,
    paddingVertical: (minimumTouchSize - 20) / 2,
  },
});
