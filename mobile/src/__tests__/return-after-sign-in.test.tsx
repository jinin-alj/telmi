import { act, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { AuthStatus } from '@/auth/auth-context';
import RootLayout from '@/app/_layout';

type MockAuth = { status: AuthStatus; user: { role: 'student' | 'teacher' } | null };

// Lets each test move the app from loading to signed out to signed in
const mockAuthControl: { setAuth: ((auth: MockAuth) => void) | null } = { setAuth: null };

jest.mock('@/api/health', () => ({ wakeBackend: jest.fn() }));
jest.mock('@/auth/auth-context', () => {
  const React = jest.requireActual('react');
  const AuthContext = React.createContext(null);
  return {
    AuthProvider: ({ children }: { children: unknown }) => {
      const [auth, setAuth] = React.useState({ status: 'loading', user: null });
      mockAuthControl.setAuth = setAuth;
      return React.createElement(AuthContext.Provider, { value: auth }, children);
    },
    useAuth: () => React.useContext(AuthContext),
  };
});

function Page({ name }: { name: string }) {
  return <Text>{name}</Text>;
}

const ROUTES = {
  _layout: RootLayout,
  index: () => <Page name="Home" />,
  'sign-in': () => <Page name="Sign in page" />,
  'sign-up': () => <Page name="Sign up page" />,
  'classroom/[classroomId]': () => <Page name="Class page" />,
  'session/[sessionId]': () => <Page name="Session page" />,
};

async function changeAuth(auth: MockAuth) {
  await act(async () => {
    if (mockAuthControl.setAuth !== null) {
      mockAuthControl.setAuth(auth);
    }
  });
}

it('returns to the page that was opened before signing in', async () => {
  await renderRouter(ROUTES, { initialUrl: '/classroom/abc' });
  await changeAuth({ status: 'signedOut', user: null });
  expect(screen.getByText('Sign in page')).toBeTruthy();

  await changeAuth({ status: 'signedIn', user: { role: 'teacher' } });

  expect(screen.getByText('Class page')).toBeTruthy();
  expect(screen).toHavePathname('/classroom/abc');
});

it('goes home after signing in from the sign-in page itself', async () => {
  await renderRouter(ROUTES, { initialUrl: '/sign-in' });
  await changeAuth({ status: 'signedOut', user: null });

  await changeAuth({ status: 'signedIn', user: { role: 'student' } });

  expect(screen.getByText('Home')).toBeTruthy();
});
