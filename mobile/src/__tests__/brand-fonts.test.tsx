import { act, renderHook, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { renderRouter } from 'expo-router/testing-library';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useBrandFonts } from '@/fonts';

// Lets each test decide when the fonts finish loading
const mockFontControl: { setReady: ((ready: boolean) => void) | null } = { setReady: null };

jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('@/api/health', () => ({ wakeBackend: jest.fn() }));
jest.mock('@/auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ status: 'signedOut', user: null }),
}));

const mockedUseFonts = jest.mocked(useFonts);

function Page({ name }: { name: string }) {
  return <Text>{name}</Text>;
}

const ROUTES = {
  _layout: RootLayout,
  index: () => <Page name="Home" />,
  'sign-in': () => <Page name="Sign in page" />,
  'sign-up': () => <Page name="Sign up page" />,
};

beforeEach(() => {
  jest.mocked(SplashScreen.hideAsync).mockClear();
});

it('keeps the splash screen up until the fonts are ready', async () => {
  const React = jest.requireActual('react');
  mockedUseFonts.mockImplementation(() => {
    const [ready, setReady] = React.useState(false);
    mockFontControl.setReady = setReady;
    return [ready, null];
  });
  await renderRouter(ROUTES, { initialUrl: '/sign-in' });

  expect(screen.queryByText('Sign in page')).toBeNull();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

  await act(async () => {
    if (mockFontControl.setReady !== null) {
      mockFontControl.setReady(true);
    }
  });

  expect(screen.getByText('Sign in page')).toBeTruthy();
  expect(SplashScreen.hideAsync).toHaveBeenCalled();
});

it('is ready once the fonts load', async () => {
  mockedUseFonts.mockReturnValue([true, null]);

  const { result } = await renderHook(() => useBrandFonts());

  expect(result.current).toBe(true);
});

it('is not ready while the fonts are still loading', async () => {
  mockedUseFonts.mockReturnValue([false, null]);

  const { result } = await renderHook(() => useBrandFonts());

  expect(result.current).toBe(false);
});

it('opens with the system font when the brand fonts fail to load', async () => {
  mockedUseFonts.mockReturnValue([false, new Error('offline')]);

  const { result } = await renderHook(() => useBrandFonts());

  expect(result.current).toBe(true);
});
