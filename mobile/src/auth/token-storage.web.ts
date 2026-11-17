// localStorage keeps the installed app signed in; safe because each refresh token works only once
const REFRESH_TOKEN_KEY = 'telmi.refresh_token';

/** Read the saved refresh token for this browser, or null. */
export async function loadRefreshToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.warn('Could not read the saved session', error);
    return null;
  }
}

/** Save the refresh token for this browser. */
export async function saveRefreshToken(refreshToken: string): Promise<void> {
  try {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.warn('Could not save the session', error);
  }
}

/** Remove the saved refresh token, for sign-out. */
export async function clearRefreshToken(): Promise<void> {
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.warn('Could not clear the saved session', error);
  }
}
