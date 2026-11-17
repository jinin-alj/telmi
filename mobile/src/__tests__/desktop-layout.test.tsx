import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Columns } from '@/components/columns';
import { Screen } from '@/components/screen';
import { isWideScreen, useIsWide } from '@/hooks/use-is-wide';

jest.mock('@/hooks/use-is-wide', () => ({
  ...jest.requireActual('@/hooks/use-is-wide'),
  useIsWide: jest.fn(),
}));
jest.mock('@/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'ms_lopez', display_name: 'Ms López', role: 'teacher' },
    signOut: jest.fn(),
  }),
}));

/** Pretend the page is shown on a desktop browser or on a phone. */
function showOnWindowOfWidth(width: number) {
  jest.mocked(useIsWide).mockReturnValue(isWideScreen('web', width));
}

describe('isWideScreen', () => {
  it('uses the desktop layout only in wide browser windows', () => {
    expect(isWideScreen('web', 1440)).toBe(true);
    expect(isWideScreen('web', 375)).toBe(false);
    // An iPad app is wide, but phones and tablets keep the touch layout
    expect(isWideScreen('ios', 1366)).toBe(false);
  });
});

describe('Columns', () => {
  it('puts the two sides next to each other on a wide screen', async () => {
    showOnWindowOfWidth(1440);
    await render(<Columns left={<Text>Units</Text>} right={<Text>Students</Text>} />);

    expect(screen.getByTestId('columns')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Students')).toBeTruthy();
  });

  it('stacks them on a phone, in the same order', async () => {
    showOnWindowOfWidth(375);
    await render(<Columns left={<Text>Units</Text>} right={<Text>Students</Text>} />);

    expect(screen.queryByTestId('columns')).toBeNull();
    expect(screen.getByText('Units')).toBeTruthy();
  });
});

describe('Screen', () => {
  it('shows the top bar with the signed-in name on a wide screen', async () => {
    showOnWindowOfWidth(1440);
    await render(
      <Screen width="wide" topBar>
        <Text>Page</Text>
      </Screen>,
    );

    expect(screen.getByText('Ms López')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('leaves phones without the top bar', async () => {
    showOnWindowOfWidth(375);
    await render(
      <Screen width="wide" topBar>
        <Text>Page</Text>
      </Screen>,
    );

    expect(screen.queryByText('Ms López')).toBeNull();
    expect(screen.getByText('Page')).toBeTruthy();
  });
});
