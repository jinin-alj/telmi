import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useIsWide } from '@/hooks/use-is-wide';
import { colors, cornerRadius, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A white panel on the grey desktop background; on phones it adds nothing visible. */
export function Card({ children, style }: CardProps) {
  const isWide = useIsWide();
  return <View style={[style, isWide ? styles.card : null]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: cornerRadius,
    padding: spacing.large,
  },
});
