import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { colors, cornerRadius } from '@/theme';

/** How bright a colour looks to the eye, as WCAG measures it. */
function luminance(hex: string): number {
  const channels = [];
  for (let start = 1; start < 7; start += 2) {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    if (value <= 0.03928) {
      channels.push(value / 12.92);
    } else {
      channels.push(((value + 0.055) / 1.055) ** 2.4);
    }
  }
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Every source file in the app, except the tests themselves. */
function appSourceFiles(folder: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') {
        files.push(...appSourceFiles(path));
      }
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      files.push(path);
    }
  }
  return files;
}

const brandTokens = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'assets', 'design-tokens.json'), 'utf8'),
);
const brand = brandTokens.primitive.color;

it('uses the Telmi v3 brand colours', () => {
  expect(colors.background).toBe(brand.neutral.canvas.$value);
  expect(colors.panel).toBe(brand.neutral.panel.$value);
  expect(colors.text).toBe(brand.neutral.ink.$value);
  expect(colors.mutedText).toBe(brand.neutral.muted.$value);
  expect(colors.primary).toBe(brand.coral['500'].$value);
  expect(colors.primaryPressed).toBe(brand.coral['600'].$value);
  expect(colors.primarySoft).toBe(brand.rust['100'].$value);
  expect(colors.link).toBe(brand.denim['500'].$value);
  expect(colors.dataSoft).toBe(brand.denim['100'].$value);
  expect(colors.emphasis).toBe(brand.rust['500'].$value);
  expect(colors.warningSoft).toBe(brand.neutral.butter.$value);
  expect(colors.divider).toBe(brand.neutral.line.$value);
  expect(colors.error).toBe(brand.status.error.$value);
  expect(cornerRadius).toBe(16);
});

it.each([
  ['text on the page', colors.text, colors.background],
  ['text on panels', colors.text, colors.panel],
  ['secondary text on the page', colors.mutedText, colors.background],
  ['secondary text on panels', colors.mutedText, colors.panel],
  ['text on coral buttons', colors.onPrimary, colors.primary],
  ['text on peach', colors.text, colors.primarySoft],
  ['text on butter', colors.text, colors.warningSoft],
  ['links on the page', colors.link, colors.background],
  ['links on panels', colors.link, colors.panel],
  ['data labels on sky', colors.link, colors.dataSoft],
  ['the emphasis on the page', colors.emphasis, colors.background],
  ['errors on the page', colors.error, colors.background],
  ['errors on panels', colors.error, colors.panel],
])('keeps %s readable (WCAG AA)', (_pairing, foreground, background) => {
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

it('keeps input borders visible against panels', () => {
  expect(contrast(colors.border, colors.panel)).toBeGreaterThanOrEqual(3);
});

it('never uses coral for text, where it is too faint to read', () => {
  const offenders: string[] = [];
  for (const file of appSourceFiles(join(__dirname, '..'))) {
    const source = readFileSync(file, 'utf8');
    if (/\bcolor: colors\.primary\b|color=\{colors\.primary\}/.test(source)) {
      offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
