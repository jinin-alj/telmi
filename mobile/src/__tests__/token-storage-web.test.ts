import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from '@/auth/token-storage.web';

/** A tiny stand-in for the browser's localStorage. */
class FakeStorage {
  items: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.items[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.items[key] = value;
  }

  removeItem(key: string): void {
    delete this.items[key];
  }
}

const savedForLater = new FakeStorage();
const thisTabOnly = new FakeStorage();

beforeEach(() => {
  savedForLater.items = {};
  thisTabOnly.items = {};
  Object.defineProperty(window, 'localStorage', { value: savedForLater, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: thisTabOnly, configurable: true });
});

it('keeps the login after the installed app or tab is closed', async () => {
  await saveRefreshToken('refresh-1');

  expect(savedForLater.items['telmi.refresh_token']).toBe('refresh-1');
  expect(await loadRefreshToken()).toBe('refresh-1');
});

it('forgets the login on sign-out', async () => {
  await saveRefreshToken('refresh-1');

  await clearRefreshToken();

  expect(await loadRefreshToken()).toBeNull();
});
