import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/api/client';
import type { UserRole } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import {
  normalizeUsername,
  validateDisplayName,
  validatePassword,
  validateUsername,
} from '@/auth/validation';
import { Button } from '@/components/button';
import { RolePicker } from '@/components/role-picker';
import { Screen } from '@/components/screen';
import { SlowRequestNotice } from '@/components/slow-request-notice';
import { TextField } from '@/components/text-field';
import { colors, minimumTouchSize, spacing } from '@/theme';

type FieldErrors = {
  username: string | null;
  displayName: string | null;
  password: string | null;
};

const NO_ERRORS: FieldErrors = { username: null, displayName: null, password: null };

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [role, setRole] = useState<UserRole>('student');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const errors = {
      username: validateUsername(username),
      displayName: validateDisplayName(displayName),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.username || errors.displayName || errors.password) {
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        username: normalizeUsername(username),
        display_name: displayName.trim(),
        password,
        role,
      });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Sign-up failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Create your account
      </Text>
      <Text style={styles.subtitle}>No email or real name needed.</Text>

      <RolePicker value={role} onChange={setRole} />
      <TextField
        label="Username"
        hint="Letters, numbers, dots and underscores."
        error={fieldErrors.username}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
      />
      <TextField
        label="Nickname"
        hint={role === 'student' ? 'This is what your teacher and buddy will call you.' : undefined}
        error={fieldErrors.displayName}
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="off"
      />
      <TextField
        label="Password"
        hint="At least 8 characters."
        error={fieldErrors.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
      />

      {formError ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.formError}>
          {formError}
        </Text>
      ) : null}

      <Button label="Create account" onPress={handleSubmit} loading={submitting} />
      <SlowRequestNotice waiting={submitting} />

      <Link href="/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
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
