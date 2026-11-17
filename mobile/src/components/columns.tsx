import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useIsWide } from '@/hooks/use-is-wide';
import { spacing } from '@/theme';

type ColumnsProps = {
  left: ReactNode;
  right: ReactNode;
  // How much of the width each side takes, e.g. 2 and 1 for a main column with a sidebar
  leftShare?: number;
  rightShare?: number;
};

/** Two columns side by side on wide screens; on phones the left one simply comes first. */
export function Columns({ left, right, leftShare = 1, rightShare = 1 }: ColumnsProps) {
  const isWide = useIsWide();
  if (!isWide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View testID="columns" style={styles.row}>
      <View style={{ flex: leftShare }}>{left}</View>
      <View style={{ flex: rightShare }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.large,
  },
});
