import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { WarningIcon } from '@/components/warning-icon';
import { colors, spacing, textStyles } from '@/theme';

type ErrorMessageProps = {
  message: string | null | undefined;
  // Each screen keeps its own spacing around the message
  style?: StyleProp<ViewStyle>;
};

/** An error in words with a warning icon, so it never depends on colour alone. */
export function ErrorMessage({ message, style }: ErrorMessageProps) {
  if (!message) {
    return null;
  }
  return (
    <View style={[styles.row, style]}>
      <WarningIcon size={20} />
      <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
  },
  text: {
    ...textStyles.body,
    flex: 1,
    color: colors.error,
  },
});
