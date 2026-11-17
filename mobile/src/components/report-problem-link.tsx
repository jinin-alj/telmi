import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, minimumTouchSize, spacing } from '@/theme';

/** A quiet link to tell the Telmi team something went wrong, from any signed-in page. */
export function ReportProblemLink() {
  const pathname = usePathname();
  if (pathname === '/report-problem') {
    return null;
  }

  function openReport() {
    // The page is sent with the report, so the team knows where it happened
    router.push({ pathname: '/report-problem', params: { from: pathname } });
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Report a problem"
      onPress={openReport}
      style={styles.link}
    >
      <Text style={styles.label}>Report a problem</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.large,
  },
  label: {
    fontSize: 14,
    color: colors.mutedText,
    textDecorationLine: 'underline',
  },
});
