import { render, screen } from '@testing-library/react-native';

import { TextField } from '@/components/text-field';

it('reads out the hint and the error together, with one full stop between them', async () => {
  await render(<TextField label="Username" hint="Letters only." error="Too short." />);

  expect(screen.getByLabelText('Username').props.accessibilityHint).toBe(
    'Letters only. Too short.',
  );
});

it('adds a full stop where a hint or error has none', async () => {
  await render(<TextField label="Username" hint="Letters only" error="Too short!" />);

  expect(screen.getByLabelText('Username').props.accessibilityHint).toBe(
    'Letters only. Too short!',
  );
});

it('reads out only what is there', async () => {
  await render(<TextField label="Username" hint="Letters only." />);
  expect(screen.getByLabelText('Username').props.accessibilityHint).toBe('Letters only.');
});

it('has no hint when there is nothing to say', async () => {
  await render(<TextField label="Username" />);
  expect(screen.getByLabelText('Username').props.accessibilityHint).toBeUndefined();
});
