import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { goHome } from '@/components/back-to-home';
import { colors, contentWidth, minimumTouchSize, spacing } from '@/theme';

/** The desktop header: the app name, who is signed in, and a way to sign out. */
export function TopBar() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Telmi home"
          onPress={goHome}
          style={styles.touchTarget}
        >
          <Text style={styles.name}>Telmi</Text>
        </Pressable>
        <View style={styles.account}>
          {user !== null ? <Text style={styles.user}>{user.display_name}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={signOut}
            style={styles.touchTarget}
          >
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
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
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.large,
  },
  user: {
    fontSize: 15,
    color: colors.mutedText,
  },
  signOut: {
    fontSize: 15,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
