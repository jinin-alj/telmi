import { readFileSync } from 'fs';
import { join, relative } from 'path';

import { appSourceFiles } from '@/testing/source-files';

const SOURCE_FOLDER = join(__dirname, '..');

// Words shown in every language, so they may be typed straight into a screen
const SAME_IN_EVERY_LANGUAGE = ['telmi', 'Telmi'];

// Text between JSX tags, like <Text>Sign in</Text>; code characters rule out TypeScript like Promise<T>
const JSX_TEXT = /(?<![=-])>([^<>{}();=|&]*[A-Za-z]{2}[^<>{}();=|&]*)</g;
// Text props people read or hear, like label="Sign in" or accessibilityLabel="Close"
const TEXT_PROP =
  /\b(label|accessibilityLabel|accessibilityHint|hint|placeholder|prompt|typingPrompt|submitLabel)="([^"]*[A-Za-z][^"]*)"/g;
// The same props built from a template, like label={`Open ${name}`}
const TEXT_TEMPLATE_PROP =
  /\b(?:label|accessibilityLabel|accessibilityHint|hint|placeholder)=\{`([^`$]*[A-Za-z]{2}[^`]*)`\}/g;
// Messages put straight into state, like setError('Something went wrong')
const MESSAGE_IN_STATE = /\bset\w*(?:Error|Message|Notice)\(\s*['"`]([^'"`]*[A-Za-z][^'"`]*)['"`]/g;

/** Every piece of English typed straight into a file's screens, as "file:line: text". */
function hardCodedText(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const pattern of [JSX_TEXT, TEXT_PROP, TEXT_TEMPLATE_PROP, MESSAGE_IN_STATE]) {
    for (const match of source.matchAll(pattern)) {
      const text = match[match.length - 1].trim();
      if (SAME_IN_EVERY_LANGUAGE.includes(text)) {
        continue;
      }
      const line = source.slice(0, match.index).split('\n').length;
      found.push(`${relative(SOURCE_FOLDER, file)}:${line}: ${text}`);
    }
  }
  return found;
}

it('keeps every word people see in the en and es text files', () => {
  const found: string[] = [];
  for (const file of appSourceFiles(SOURCE_FOLDER)) {
    // The text files themselves and the test helpers are where words are meant to be
    if (file.includes(`${join('src', 'i18n')}`) || file.includes(`${join('src', 'testing')}`)) {
      continue;
    }
    if (file.endsWith('.tsx')) {
      found.push(...hardCodedText(file));
    }
  }

  expect(found).toEqual([]);
});
