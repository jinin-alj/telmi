import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BackToHome } from '@/components/back-to-home';

jest.mock('expo-router', () => ({
  router: { canDismiss: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
}));

const mockedRouter = jest.mocked(router);

beforeEach(() => {
  jest.clearAllMocks();
});

it('goes back to the home screen already open, so Back never finds a second one', async () => {
  mockedRouter.canDismiss.mockReturnValue(true);
  await render(<BackToHome />);

  await fireEvent.press(screen.getByRole('button', { name: 'Back to my classes' }));

  expect(router.dismissTo).toHaveBeenCalledWith('/');
  expect(router.replace).not.toHaveBeenCalled();
});

it('opens home when the page was opened directly from a link', async () => {
  mockedRouter.canDismiss.mockReturnValue(false);
  await render(<BackToHome />);

  await fireEvent.press(screen.getByRole('button', { name: 'Back to my classes' }));

  expect(router.replace).toHaveBeenCalledWith('/');
});
