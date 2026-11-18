import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import SignInScreen from '@/app/sign-in';
import SignUpScreen from '@/app/sign-up';
import { useAuth } from '@/auth/auth-context';
import { es } from '@/i18n/es';
import { LanguageProvider } from '@/i18n/language-context';
import { loadLanguage } from '@/i18n/language-storage';

jest.mock('@/auth/auth-context');
jest.mock('@/i18n/language-storage');
// Screens are rendered alone here, so a plain text link stands in for the router's Link
jest.mock('expo-router', () => {
  // Jest hoists this factory above the imports, so it must load its own dependencies
  const { createElement } = jest.requireActual('react');
  const { Text: NativeText } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: string }) => createElement(NativeText, null, children),
  };
});

const mockedUseAuth = jest.mocked(useAuth);
const signIn = jest.fn();
const signUp = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  mockedUseAuth.mockReturnValue({
    status: 'signedOut',
    user: null,
    signIn,
    signUp,
    signOut: jest.fn(),
  });
});

describe('SignUpScreen', () => {
  it('greets with a waving Pip', async () => {
    await render(<SignUpScreen />);

    expect(screen.getByTestId('pip-wave', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Create your account' })).toBeTruthy();
  });

  it('shows field errors and does not call the server for invalid input', async () => {
    await render(<SignUpScreen />);

    await fireEvent.changeText(screen.getByLabelText('Username'), 'a b');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use only letters, numbers, dots and underscores.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(screen.getByText('Add a nickname. It does not have to be your real name.')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends a normalised form with the chosen role', async () => {
    signUp.mockResolvedValue(undefined);
    await render(<SignUpScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: "I'm a teacher" }));
    await fireEvent.changeText(screen.getByLabelText('Username'), '  Ms_Lopez ');
    await fireEvent.changeText(screen.getByLabelText('Nickname'), ' Ms López ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        username: 'ms_lopez',
        display_name: 'Ms López',
        password: 'long-enough',
        role: 'teacher',
      }),
    );
  });

  it('shows the server error when the username is taken', async () => {
    signUp.mockRejectedValue(new ApiError(409, 'That username is already taken'));
    await render(<SignUpScreen />);

    await fireEvent.changeText(screen.getByLabelText('Username'), 'ana_g');
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Ana');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText('That username is already taken')).toBeTruthy());
  });
});

describe('SignInScreen', () => {
  it('greets with a waving Pip and the telmi logo, still read out as Telmi', async () => {
    await render(<SignInScreen />);

    expect(screen.getByRole('header', { name: 'Telmi' })).toBeTruthy();
    expect(screen.getByText('telmi', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('pip-wave', { includeHiddenElements: true })).toBeTruthy();
  });

  it('asks for both fields before calling the server', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your username and password.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows the server message when the password is wrong', async () => {
    signIn.mockRejectedValue(new ApiError(401, 'Wrong username or password'));
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Username'), 'Ana_G');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'nope-nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('Wrong username or password')).toBeTruthy());
    expect(signIn).toHaveBeenCalledWith('ana_g', 'nope-nope');
  });
});

describe('in Spanish', () => {
  beforeEach(() => {
    jest.mocked(loadLanguage).mockResolvedValue('es');
  });

  it('shows the sign-in page and its errors in Spanish', async () => {
    signIn.mockRejectedValue(new ApiError(401, 'Wrong username or password', 'wrong_login'));
    await render(
      <LanguageProvider>
        <SignInScreen />
      </LanguageProvider>,
    );

    const submit = await screen.findByRole('button', { name: es.signIn.submit });
    await fireEvent.changeText(screen.getByLabelText(es.signIn.username), 'ana_g');
    await fireEvent.changeText(screen.getByLabelText(es.signIn.password), 'nope-nope');
    await fireEvent.press(submit);

    await waitFor(() => expect(screen.getByText(es.errors.wrong_login)).toBeTruthy());
  });

  it('checks the sign-up form in Spanish', async () => {
    await render(
      <LanguageProvider>
        <SignUpScreen />
      </LanguageProvider>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: es.signUp.submit }));

    expect(screen.getByRole('header', { name: es.signUp.title })).toBeTruthy();
    expect(screen.getByText(es.validation.nicknameMissing)).toBeTruthy();
    expect(screen.getByText(es.validation.atLeast(8))).toBeTruthy();
  });
});
