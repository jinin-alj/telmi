import { StyleSheet, Text, View } from 'react-native';

import { colors, cornerRadius, spacing } from '@/theme';

/** A class's join code in large spaced letters, easy to read out or copy onto a board. */
export function JoinCode({ code }: { code: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`Join code ${code.split('').join(' ')}`}
      style={styles.box}
    >
      <Text style={styles.label}>Join code</Text>
      <Text selectable style={styles.code}>
        {code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primarySoft,
    borderRadius: cornerRadius,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    color: colors.mutedText,
  },
  code: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.text,
  },
});
