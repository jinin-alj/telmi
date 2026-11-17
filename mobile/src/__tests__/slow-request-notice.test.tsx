import { act, render, screen } from '@testing-library/react-native';

import { Loading } from '@/components/loading';
import { SlowRequestNotice } from '@/components/slow-request-notice';

const NOTICE = 'Waking up the server, this can take up to a minute.';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('stays quiet while a request is quick', async () => {
  await render(<SlowRequestNotice waiting />);

  await act(async () => {
    jest.advanceTimersByTime(4000);
  });

  expect(screen.queryByText(NOTICE)).toBeNull();
});

it('explains the wait once a request is slow', async () => {
  await render(<SlowRequestNotice waiting />);

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(screen.getByText(NOTICE)).toBeTruthy();
});

it('disappears when the request finishes', async () => {
  const { rerender } = await render(<SlowRequestNotice waiting />);
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  await rerender(<SlowRequestNotice waiting={false} />);

  expect(screen.queryByText(NOTICE)).toBeNull();
});

it('explains a slow page load too, not just slow sign-ins', async () => {
  await render(<Loading label="Opening your session" />);

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(screen.getByLabelText('Opening your session')).toBeTruthy();
  expect(screen.getByText(NOTICE)).toBeTruthy();
});
