import { createContext, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportProblemLink } from '@/components/report-problem-link';
import { TopBar } from '@/components/top-bar';
import { useIsWide } from '@/hooks/use-is-wide';
import { colors, contentWidth, cornerRadius, spacing } from '@/theme';

/** Lets a child pause page scrolling, so dragging a pen across a drawing doesn't move the page. */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

type ScreenProps = {
  children: ReactNode;
  // "narrow" for forms like sign-in; "wide" for dashboards and sessions on big screens
  width?: 'narrow' | 'wide';
  // For pages people see once signed in: the desktop header and a "Report a problem" link
  topBar?: boolean;
};

/** The content area's style: the phone column, a centred form card, or a wide dashboard. */
function contentStyle(isWide: boolean, width: 'narrow' | 'wide'): StyleProp<ViewStyle> {
  if (!isWide) {
    return styles.phoneContent;
  }
  if (width === 'wide') {
    return styles.wideContent;
  }
  return styles.formContent;
}

/** Page wrapper: safe areas, keyboard avoidance, scrolling and a readable width. */
export function Screen({ children, width = 'narrow', topBar = false }: ScreenProps) {
  const [scrollLocked, setScrollLocked] = useState(false);
  const isWide = useIsWide();

  // A narrow page on a big screen sits in a card, so it doesn't float on a blank page
  let body = children;
  if (isWide && width === 'narrow') {
    body = <View style={styles.formCard}>{children}</View>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, isWide ? styles.desktopBackground : null]}>
      {isWide && topBar ? <TopBar /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollLockContext.Provider value={setScrollLocked}>
          <ScrollView
            contentContainerStyle={contentStyle(isWide, width)}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!scrollLocked}
          >
            {body}
            {topBar ? <ReportProblemLink /> : null}
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
  desktopBackground: {
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  phoneContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.large,
    width: '100%',
    maxWidth: contentWidth.narrow,
    alignSelf: 'center',
  },
  formContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.large,
    width: '100%',
    // Room for the card's own padding around a narrow form
    maxWidth: contentWidth.narrow + spacing.large * 2,
    alignSelf: 'center',
  },
  wideContent: {
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.large * 1.5,
    width: '100%',
    maxWidth: contentWidth.wide,
    alignSelf: 'center',
  },
  formCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: cornerRadius,
    padding: spacing.large * 1.5,
  },
});
