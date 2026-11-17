import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';
import type { AuthResponse } from '@/api/types';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import * as tokenStorage from '@/auth/token-storage';

jest.mock('@/api/auth');
jest.mock('@/auth/token-storage');

const mockedAuthApi = jest.mocked(authApi);
const mockedStorage = jest.mocked(tokenStorage);

const SIGNED_IN: AuthResponse = {
  access_token: 'access-1',
  refresh_token: 'refresh-2',
  token_type: 'bearer',
  user: { id: 'user-1', username: 'ana_g', display_name: 'Ana', role: 'student' },
};

/** Shows the auth state and offers sign-in and sign-out buttons. */
function AuthProbe() {
  const { status, user, signIn, signOut } = useAuth();
  return (
    <>
      <Text>status:{status}</Text>
      <Text>user:{user?.display_name ?? 'none'}</Text>
      <Pressable accessibilityRole="button" onPress={() => signIn('ana_g', 'secret-pass')}>
        <Text>sign in</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={signOut}>
        <Text>sign out</Text>
      </Pressable>
    </>
  );
}

async function renderProbe() {
  await render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedStorage.loadRefreshToken.mockResolvedValue(null);
  mockedStorage.saveRefreshToken.mockResolvedValue();
  mockedStorage.clearRefreshToken.mockResolvedValue();
});

it('starts signed out when nothing is saved', async () => {
  await renderProbe();

  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  expect(mockedAuthApi.refresh).not.toHaveBeenCalled();
});

it('restores a saved session on launch', async () => {
  mockedStorage.loadRefreshToken.mockResolvedValue('refresh-1');
  mockedAuthApi.refresh.mockResolvedValue(SIGNED_IN);

  await renderProbe();

  await waitFor(() => expect(screen.getByText('status:signedIn')).toBeTruthy());
  expect(screen.getByText('user:Ana')).toBeTruthy();
  expect(mockedAuthApi.refresh).toHaveBeenCalledWith('refresh-1');
  expect(mockedStorage.saveRefreshToken).toHaveBeenCalledWith('refresh-2');
});

it('clears an expired saved session', async () => {
  mockedStorage.loadRefreshToken.mockResolvedValue('expired');
  mockedAuthApi.refresh.mockRejectedValue(new ApiError(401, 'Session expired'));

  await renderProbe();

  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  expect(mockedStorage.clearRefreshToken).toHaveBeenCalled();
});

it.each([
  ['offline', new ApiError(0, "Can't reach Telmi.")],
  ['the server is waking up', new ApiError(503, 'Something went wrong on our side.')],
])('keeps the saved session when %s', async (_reason, error) => {
  mockedStorage.loadRefreshToken.mockResolvedValue('refresh-1');
  mockedAuthApi.refresh.mockRejectedValue(error);

  await renderProbe();

  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  // Kept, so opening the app again once online signs the student straight back in
  expect(mockedStorage.clearRefreshToken).not.toHaveBeenCalled();
});

it('signs in and out', async () => {
  mockedAuthApi.login.mockResolvedValue(SIGNED_IN);
  await renderProbe();
  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());

  await fireEvent.press(screen.getByText('sign in'));
  await waitFor(() => expect(screen.getByText('user:Ana')).toBeTruthy());
  expect(mockedAuthApi.login).toHaveBeenCalledWith('ana_g', 'secret-pass');

  await fireEvent.press(screen.getByText('sign out'));
  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  expect(screen.getByText('user:none')).toBeTruthy();
});

it('ends the session on the server when signing out', async () => {
  mockedStorage.loadRefreshToken.mockResolvedValue('refresh-1');
  mockedAuthApi.refresh.mockResolvedValue(SIGNED_IN);
  mockedAuthApi.logout.mockResolvedValue();
  await renderProbe();
  await waitFor(() => expect(screen.getByText('user:Ana')).toBeTruthy());
  mockedStorage.loadRefreshToken.mockResolvedValue('refresh-2');

  await fireEvent.press(screen.getByText('sign out'));

  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  expect(mockedAuthApi.logout).toHaveBeenCalledWith('refresh-2');
  expect(mockedStorage.clearRefreshToken).toHaveBeenCalled();
});

it('still signs out on this device when offline', async () => {
  mockedStorage.loadRefreshToken.mockResolvedValue('refresh-1');
  mockedAuthApi.refresh.mockResolvedValue(SIGNED_IN);
  mockedAuthApi.logout.mockRejectedValue(new ApiError(0, "Can't reach Telmi."));
  await renderProbe();
  await waitFor(() => expect(screen.getByText('user:Ana')).toBeTruthy());

  await fireEvent.press(screen.getByText('sign out'));

  await waitFor(() => expect(screen.getByText('status:signedOut')).toBeTruthy());
  expect(mockedStorage.clearRefreshToken).toHaveBeenCalled();
});
