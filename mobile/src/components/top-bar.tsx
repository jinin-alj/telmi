import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { goHome } from '@/components/back-to-home';
import { Wordmark } from '@/components/wordmark';
import { useTexts } from '@/i18n/language-context';
import { colors, contentWidth, minimumTouchSize, spacing, textStyles } from '@/theme';

/** The desktop header: the app name, who is signed in, and a way to sign out. */
export function TopBar() {
  const { user, signOut } = useAuth();
  const texts = useTexts();

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={texts.nav.home}
          onPress={goHome}
          style={styles.touchTarget}
        >
          <Wordmark size="small" />
        </Pressable>
        <View style={styles.account}>
          {user !== null ? <Text style={styles.user}>{user.display_name}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={texts.nav.signOut}
            onPress={signOut}
            style={styles.touchTarget}
          >
            <Text style={styles.signOut}>{texts.nav.signOut}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  inner: {
    width: '100%',
    maxWidth: contentWidth.wide,
    alignSelf: 'center',
    paddingHorizontal: spacing.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  touchTarget: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.large,
  },
  user: {
    ...textStyles.body,
    color: colors.mutedText,
  },
  signOut: {
    ...textStyles.body,
    color: colors.link,
    textDecorationLine: 'underline',
  },
});
