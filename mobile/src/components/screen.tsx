import { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

// Keeps forms readable on tablets and wide browser windows
const MAX_CONTENT_WIDTH = 480;

/** Lets a child pause page scrolling, so dragging a pen across a drawing doesn't move the page. */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Page wrapper: safe areas, keyboard avoidance, scrolling and a readable width. */
export function Screen({ children }: { children: ReactNode }) {
  const [scrollLocked, setScrollLocked] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollLockContext.Provider value={setScrollLocked}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!scrollLocked}
          >
            {children}
          </ScrollView>
        </ScrollLockContext.Provider>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.large,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
