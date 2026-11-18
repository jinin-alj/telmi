import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage, useTexts } from '@/i18n/language-context';
import type { AppLanguage } from '@/i18n/languages';
import { colors, fonts, minimumTouchSize, spacing, textStyles } from '@/theme';

// Each language is named in its own words, so people can find theirs whatever is showing
const LANGUAGE_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

/** A small "English · Español" choice at the foot of every page. */
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const texts = useTexts();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={texts.language.label}
      style={styles.row}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const selected = option.value === language;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => setLanguage(option.value)}
            style={styles.option}
          >
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.medium,
    marginTop: spacing.small,
  },
  option: {
    minHeight: minimumTouchSize,
    minWidth: minimumTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.small,
  },
  label: {
    ...textStyles.caption,
    color: colors.mutedText,
    textDecorationLine: 'underline',
  },
  // The current language is darker and bold, and not underlined because it isn't a link
  selectedLabel: {
    fontFamily: fonts.bodyStrong,
    color: colors.text,
    textDecorationLine: 'none',
  },
});
