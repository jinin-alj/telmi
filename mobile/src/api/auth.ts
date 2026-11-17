import { apiClient } from '@/api/client';
import type { AuthResponse, RegisterForm } from '@/api/types';

/** Create an account and receive tokens. */
export function register(form: RegisterForm): Promise<AuthResponse> {
  return apiClient.request<AuthResponse>('POST', '/auth/register', {
    body: form,
    authenticated: false,
  });
}

/** Sign in with username and password. */
export function login(username: string, password: string): Promise<AuthResponse> {
  return apiClient.request<AuthResponse>('POST', '/auth/login', {
    body: { username, password },
    authenticated: false,
  });
}

/** Trade a refresh token for a new token pair. */
export function refresh(refreshToken: string): Promise<AuthResponse> {
  return apiClient.request<AuthResponse>('POST', '/auth/refresh', {
    body: { refresh_token: refreshToken },
    authenticated: false,
  });
}

/** End this device's sign-in on the server, so its saved token stops working. */
export async function logout(refreshToken: string): Promise<void> {
  await apiClient.request<null>('POST', '/auth/logout', {
    body: { refresh_token: refreshToken },
    authenticated: false,
  });
}
