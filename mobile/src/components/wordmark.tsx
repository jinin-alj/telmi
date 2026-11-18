import { StyleSheet, Text, View } from 'react-native';

import { Pip } from '@/components/pip';
import type { PipMood } from '@/components/pip';
import { colors, spacing, textStyles } from '@/theme';

// The top bar's logo is small; the sign-in pages' logo is the page's first thing
const PIP_SIZE = { small: 36, large: 64 };

type WordmarkProps = {
  size: 'small' | 'large';
  mood?: PipMood;
};

/** The Telmi logo: Pip followed by "telmi" in lowercase; the parent gives screen readers its name. */
export function Wordmark({ size, mood = 'happy' }: WordmarkProps) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.row}>
      <Pip mood={mood} size={PIP_SIZE[size]} />
      <Text style={size === 'small' ? styles.small : styles.large}>telmi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  small: {
    ...textStyles.section,
    color: colors.text,
  },
  large: {
    ...textStyles.title,
    color: colors.text,
  },
});
