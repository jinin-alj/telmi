import { readFileSync } from 'fs';
import { join } from 'path';

const publicFolder = join(__dirname, '..', '..', 'public');

function readPublicFile(name: string): string {
  return readFileSync(join(publicFolder, name), 'utf8');
}

it('lets the installed app turn with the tablet', () => {
  const manifest = JSON.parse(readPublicFile('manifest.json'));

  expect(manifest.orientation).toBe('any');
});

it('has an icon Android can crop to its own shape', () => {
  const manifest = JSON.parse(readPublicFile('manifest.json'));
  const purposes: string[] = [];
  for (const icon of manifest.icons) {
    purposes.push(icon.purpose);
  }

  expect(purposes).toContain('maskable');
});

it('uses the HTML spelling of http-equiv, not the React one', () => {
  const page = readPublicFile('index.html');

  expect(page).toContain('http-equiv=');
  expect(page).not.toContain('httpEquiv=');
});
