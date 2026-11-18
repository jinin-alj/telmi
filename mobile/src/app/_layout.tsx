import { Stack, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { wakeBackend } from '@/api/health';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { useBrandFonts } from '@/fonts';
import { LanguageProvider, useLanguage } from '@/i18n/language-context';
import { startErrorReporting } from '@/monitoring/error-reporting';

// Keep the splash up until the saved session, fonts and language are known, to avoid flashes
SplashScreen.preventAutoHideAsync();

// The free backend sleeps when idle; start waking it while the person is still typing
wakeBackend();

// Crash reports go to Sentry only when the build has a Sentry address
startErrorReporting();

// Pages that are never worth coming back to after signing in
const START_PAGES = ['/', '/sign-in', '/sign-up'];

function RootNavigator() {
  const { status, user } = useAuth();
  const fontsReady = useBrandFonts();
  const { loaded: languageReady } = useLanguage();
  const ready = status !== 'loading' && fontsReady && languageReady;
  const signedIn = status === 'signedIn';
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  // The page the app was opened on, e.g. a bookmarked class, so signing in goes back there
  const pathname = usePathname();
  const [openedPage] = useState(pathname);
  let pageAfterSignIn: Href = '/';
  if (!START_PAGES.includes(openedPage)) {
    // The router gave us this path, so it is a real page even though its type is a plain string
    pageAfterSignIn = openedPage as Href;
  }

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        <Stack.Screen name="index" />
        <Stack.Screen name="report-problem" />
        {/* The API enforces these roles too; the guards just keep people off screens they can't use */}
        <Stack.Protected guard={isStudent} redirectTo="/">
          <Stack.Screen name="session/[sessionId]" />
        </Stack.Protected>
        <Stack.Protected guard={isTeacher} redirectTo="/">
          <Stack.Screen name="classroom/[classroomId]" />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo={pageAfterSignIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </LanguageProvider>
  );
}
