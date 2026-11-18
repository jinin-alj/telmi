import { StyleSheet, Text, View } from 'react-native';

import { useTexts } from '@/i18n/language-context';
import { colors, textStyles } from '@/theme';

type ShareBarProps = {
  count: number;
  total: number;
  label: string;
};

/** A bar showing count out of total, with the numbers in words so it never relies on colour. */
export function ShareBar({ count, total, label }: ShareBarProps) {
  const percent = total === 0 ? 0 : Math.round((100 * count) / total);
  const texts = useTexts();
  const description = texts.shareBar.countOf(count, total, label);

  return (
    <View accessible accessibilityLabel={description}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.caption}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.dataSoft,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    backgroundColor: colors.data,
  },
  caption: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 4,
  },
});
