import { readFileSync } from 'fs';
import { join, relative } from 'path';

import { render, screen } from '@testing-library/react-native';

import { ChoiceGroup } from '@/components/choice-group';
import { appSourceFiles } from '@/testing/source-files';

const SOURCE_FOLDER = join(__dirname, '..');

it('describes states with aria props, which browsers also receive', () => {
  // react-native-web ignores accessibilityState (apart from disabled), so screen readers miss it
  const found: string[] = [];
  for (const file of appSourceFiles(SOURCE_FOLDER)) {
    if (readFileSync(file, 'utf8').includes('accessibilityState')) {
      found.push(relative(SOURCE_FOLDER, file));
    }
  }

  expect(found).toEqual([]);
});

it('marks the picked option as checked for screen readers', async () => {
  await render(
    <ChoiceGroup
      label="Account type"
      options={[
        { value: 'student', label: 'Student' },
        { value: 'teacher', label: 'Teacher' },
      ]}
      value="teacher"
      onChange={jest.fn()}
    />,
  );

  expect(screen.getByRole('radio', { name: 'Teacher' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Student' })).not.toBeChecked();
});
