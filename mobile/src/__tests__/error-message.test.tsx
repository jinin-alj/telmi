import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ErrorMessage } from '@/components/error-message';
import { TextField } from '@/components/text-field';
import { appSourceFiles } from '@/testing/source-files';

// The warning icon is hidden from screen readers, since the words say the same thing
const HIDDEN = { includeHiddenElements: true };

it('shows an error in words with a warning icon, so it never relies on colour', async () => {
  await render(<ErrorMessage message="Could not load your classes." />);

  expect(screen.getByRole('alert')).toHaveTextContent('Could not load your classes.');
  expect(screen.getByTestId('warning-icon', HIDDEN)).toBeTruthy();
});

it('shows nothing when there is no error', async () => {
  await render(<ErrorMessage message={null} />);

  expect(screen.queryByTestId('warning-icon', HIDDEN)).toBeNull();
});

it('puts the warning icon next to a field error too', async () => {
  await render(<TextField label="Class name" error="Give the class a name." value="" />);

  expect(screen.getByText('Give the class a name.')).toBeTruthy();
  expect(screen.getByTestId('warning-icon', HIDDEN)).toBeTruthy();
});

it('shows every page error through ErrorMessage', () => {
  const offenders: string[] = [];
  for (const file of appSourceFiles(join(__dirname, '..'))) {
    // The drawing error has its own icon: a confused Pip
    if (file.endsWith('error-message.tsx') || file.endsWith('drawing-pad.tsx')) {
      continue;
    }
    if (readFileSync(file, 'utf8').includes('accessibilityRole="alert"')) {
      offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
