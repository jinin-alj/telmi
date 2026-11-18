import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip';
import { SlowRequestNotice } from '@/components/slow-request-notice';
import { colors, spacing } from '@/theme';

/** A page's loading spinner, which explains itself if the free server is slow to wake up. */
export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Pip mood="thinking" size={72} />
      <ActivityIndicator accessibilityLabel={label} color={colors.link} />
      <SlowRequestNotice waiting />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.small,
  },
});
