import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTexts } from '@/i18n/language-context';
import { colors, minimumTouchSize, spacing, textStyles } from '@/theme';

/** A quiet link to tell the Telmi team something went wrong, from any signed-in page. */
export function ReportProblemLink() {
  const pathname = usePathname();
  const texts = useTexts();
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
      accessibilityLabel={texts.nav.reportProblem}
      onPress={openReport}
      style={styles.link}
    >
      <Text style={styles.label}>{texts.nav.reportProblem}</Text>
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
    ...textStyles.caption,
    color: colors.mutedText,
    textDecorationLine: 'underline',
  },
});
