import { render, screen } from '@testing-library/react-native';

import { Loading } from '@/components/loading';
import { Pip, PIP_MOODS } from '@/components/pip';
import { Wordmark } from '@/components/wordmark';

// Pip is hidden from screen readers, so queries have to ask for hidden elements
const HIDDEN = { includeHiddenElements: true };

it.each(PIP_MOODS)('draws Pip %s', async (mood) => {
  await render(<Pip mood={mood} size={80} />);

  expect(screen.getByTestId(`pip-${mood}`, HIDDEN)).toBeTruthy();
});

it('keeps Pip out of the screen reader, since the words next to it say everything', async () => {
  await render(<Pip mood="happy" size={80} />);

  expect(screen.queryByTestId('pip-happy')).toBeNull();
});

it('writes the logo as telmi in lowercase next to a happy Pip', async () => {
  await render(<Wordmark size="small" />);

  expect(screen.getByText('telmi', HIDDEN)).toBeTruthy();
  expect(screen.getByTestId('pip-happy', HIDDEN)).toBeTruthy();
});

it('shows Pip thinking while a page loads', async () => {
  await render(<Loading label="Loading your classes" />);

  expect(screen.getByTestId('pip-thinking', HIDDEN)).toBeTruthy();
  expect(screen.getByLabelText('Loading your classes')).toBeTruthy();
});
