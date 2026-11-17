import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useIsWide } from '@/hooks/use-is-wide';
import { colors, cornerRadius, panelShadow, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A white panel on the cream desktop page; on phones it adds nothing visible. */
export function Card({ children, style }: CardProps) {
  const isWide = useIsWide();
  return <View style={[style, isWide ? styles.card : null]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    boxShadow: panelShadow,
    borderRadius: cornerRadius,
    padding: spacing.large,
  },
});
