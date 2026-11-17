import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, minimumTouchSize } from '@/theme';

/** Go back to the home screen already open, so Back never lands on a second copy of it. */
export function goHome() {
  if (router.canDismiss()) {
    router.dismissTo('/');
  } else {
    // Opened straight from a link, so there is no home screen underneath yet
    router.replace('/');
  }
}

/** "‹ My classes" link back to the home screen. */
export function BackToHome() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to my classes"
      onPress={goHome}
      style={styles.back}
    >
      <Text style={styles.label}>‹ My classes</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    color: colors.link,
    fontSize: 16,
  },
});
