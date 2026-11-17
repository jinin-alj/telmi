import { Platform, useWindowDimensions } from 'react-native';

import { wideScreenWidth } from '@/theme';

/** Whether a screen gets the desktop layout: only browser windows, and only wide ones. */
export function isWideScreen(platform: string, width: number): boolean {
  return platform === 'web' && width >= wideScreenWidth;
}

/** True in a wide browser window, where pages switch to the desktop layout. */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return isWideScreen(Platform.OS, width);
}
