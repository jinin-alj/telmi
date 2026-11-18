import { readFileSync } from 'fs';
import { join } from 'path';

const mobileFolder = join(__dirname, '..', '..');
const appConfig = JSON.parse(readFileSync(join(mobileFolder, 'app.json'), 'utf8')).expo;
const manifest = JSON.parse(readFileSync(join(mobileFolder, 'public', 'manifest.json'), 'utf8'));

type PngInfo = { width: number; height: number; transparent: boolean };

/** Reads a PNG's size and whether it has see-through pixels, from its header. */
function pngInfo(path: string): PngInfo {
  const bytes = readFileSync(join(mobileFolder, path));
  // PNG colour types 4 and 6 carry an alpha channel
  const colourType = bytes[25];
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    transparent: colourType === 4 || colourType === 6,
  };
}

it('has a square, solid app icon at App Store size', () => {
  expect(pngInfo(appConfig.icon)).toEqual({ width: 1024, height: 1024, transparent: false });
});

it('uses the same Pip icon on iPhones instead of the Expo template', () => {
  expect(appConfig.ios?.icon).toBeUndefined();
});

it('gives Android a see-through Pip in front of a solid background', () => {
  const adaptive = appConfig.android.adaptiveIcon;
  expect(pngInfo(adaptive.foregroundImage)).toMatchObject({ width: 512, transparent: true });
  expect(pngInfo(adaptive.backgroundImage)).toMatchObject({ width: 512, transparent: false });
  expect(pngInfo(adaptive.monochromeImage)).toMatchObject({ width: 432, transparent: true });
});

it('has a see-through splash Pip and browser tab icon', () => {
  let splashImage = '';
  for (const plugin of appConfig.plugins) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
      splashImage = plugin[1].image;
    }
  }
  expect(pngInfo(splashImage).transparent).toBe(true);
  expect(pngInfo(appConfig.web.favicon)).toEqual({ width: 48, height: 48, transparent: true });
});

it('lists every install icon at its real size', () => {
  for (const icon of manifest.icons) {
    const info = pngInfo(join('public', icon.src));
    expect(`${info.width}x${info.height}`).toBe(icon.sizes);
  }
});

it('gives Android its own solid icon to crop, not the regular one', () => {
  const regular: string[] = [];
  let maskable = null;
  for (const icon of manifest.icons) {
    if (icon.purpose === 'maskable') {
      maskable = icon.src;
    } else {
      regular.push(icon.src);
    }
  }
  expect(maskable).not.toBeNull();
  expect(regular).not.toContain(maskable);
  expect(pngInfo(join('public', String(maskable))).transparent).toBe(false);
});

it('has a solid iPhone home screen icon', () => {
  expect(pngInfo('public/apple-touch-icon.png')).toEqual({
    width: 180,
    height: 180,
    transparent: false,
  });
});
