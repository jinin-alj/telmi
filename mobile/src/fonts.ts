import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { useFonts } from 'expo-font';

// The only weights the app uses, imported one by one so the others stay out of the download
export const fontFiles = {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Figtree_400Regular,
  Figtree_600SemiBold,
};

/** True once the brand fonts are ready, or have failed and the system font is used instead. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(fontFiles);
  return loaded || error !== null;
}
