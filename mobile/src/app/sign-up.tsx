import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { UserRole } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import {
  normalizeUsername,
  validateDisplayName,
  validatePassword,
  validateUsername,
} from '@/auth/validation';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { RolePicker } from '@/components/role-picker';
import { Screen } from '@/components/screen';
import { SlowRequestNotice } from '@/components/slow-request-notice';
import { TextField } from '@/components/text-field';
import { Wordmark } from '@/components/wordmark';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, minimumTouchSize, spacing, textStyles } from '@/theme';

type FieldErrors = {
  username: string | null;
  displayName: string | null;
  password: string | null;
};

const NO_ERRORS: FieldErrors = { username: null, displayName: null, password: null };

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const texts = useTexts();
  const [role, setRole] = useState<UserRole>('student');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const errors = {
      username: validateUsername(username, texts.validation),
      displayName: validateDisplayName(displayName, texts.validation),
      password: validatePassword(password, texts.validation),
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
      setFormError(errorText(error, texts, texts.signUp.failed));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.logo}>
        <Wordmark size="large" mood="wave" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {texts.signUp.title}
      </Text>
      <Text style={styles.subtitle}>{texts.signUp.subtitle}</Text>

      <RolePicker value={role} onChange={setRole} />
      <TextField
        label={texts.signUp.username}
        hint={texts.signUp.usernameHint}
        error={fieldErrors.username}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
      />
      <TextField
        label={texts.signUp.nickname}
        hint={role === 'student' ? texts.signUp.nicknameHint : undefined}
        error={fieldErrors.displayName}
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="off"
      />
      <TextField
        label={texts.signUp.password}
        hint={texts.signUp.passwordHint}
        error={fieldErrors.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
      />

      <ErrorMessage message={formError} style={styles.formError} />

      <Button label={texts.signUp.submit} onPress={handleSubmit} loading={submitting} />
      <SlowRequestNotice waiting={submitting} />

      <Link href="/sign-in" style={styles.link}>
        {texts.signUp.toSignIn}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    marginBottom: spacing.medium,
  },
  title: {
    ...textStyles.title,
    color: colors.text,
  },
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
