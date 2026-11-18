import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { WarningIcon } from '@/components/warning-icon';
import { colors, cornerRadius, fonts, minimumTouchSize, spacing, textStyles } from '@/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** A labelled text input that announces its hint and error to screen readers. */
export function TextField({ label, hint, error, style, ...inputProps }: TextFieldProps) {
  const description = [hint, error].filter(Boolean).join('. ');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={description === '' ? undefined : description}
        placeholderTextColor={colors.mutedText}
        {...inputProps}
        // Callers' styles add to the base look instead of replacing it
        style={[styles.input, error ? styles.inputWithError : null, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <View style={styles.errorRow}>
          <WarningIcon size={16} />
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.medium,
  },
  label: {
    ...textStyles.bodyStrong,
    color: colors.text,
    marginBottom: 4,
  },
  input: {
    minHeight: minimumTouchSize,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: cornerRadius,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: textStyles.body.fontSize,
    color: colors.text,
    backgroundColor: colors.panel,
  },
  inputWithError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  hint: {
    ...textStyles.caption,
    marginTop: 4,
    color: colors.mutedText,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  error: {
    ...textStyles.caption,
    flex: 1,
    color: colors.error,
  },
});
