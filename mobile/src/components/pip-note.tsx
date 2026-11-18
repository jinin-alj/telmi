import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip';
import type { PipMood } from '@/components/pip';
import { spacing } from '@/theme';

/** A short message with a small Pip beside it, for empty lists and things Pip couldn't do. */
export function PipNote({ mood, children }: { mood: PipMood; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Pip mood={mood} size={56} />
      <View style={styles.message}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  message: {
    flex: 1,
  },
});
