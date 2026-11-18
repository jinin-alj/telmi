import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing, textStyles } from '@/theme';

// A normal request answers well within this; longer usually means the free server is waking up
const SLOW_AFTER_MILLISECONDS = 5000;

/** Tells people why the first request can take a while instead of leaving them guessing. */
export function SlowRequestNotice({ waiting }: { waiting: boolean }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MILLISECONDS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [waiting]);

  if (!waiting || !slow) {
    return null;
  }
  return (
    <Text accessibilityLiveRegion="polite" style={styles.notice}>
      Waking up the server, this can take up to a minute.
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    ...textStyles.body,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.small,
  },
});
