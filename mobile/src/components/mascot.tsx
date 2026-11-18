import { StyleSheet, Text, View } from 'react-native';

import type { Mascot as MascotProgress } from '@/api/types';
import { Pip } from '@/components/pip';
import { useTexts } from '@/i18n/language-context';
import { colors, cornerRadius, spacing, textStyles } from '@/theme';

const BASE_SIZE = 72;
const GROWTH_PER_LEVEL = 12;
const MAX_SIZE = 140;

/** How big Pip is drawn at a level, so growth is visible but bounded. */
export function mascotSize(level: number): number {
  return Math.min(MAX_SIZE, BASE_SIZE + (level - 1) * GROWTH_PER_LEVEL);
}

/** Pip's level card; Pip grows only from ideas the student has explained. */
export function Mascot({ mascot }: { mascot: MascotProgress }) {
  const size = mascotSize(mascot.level);
  const texts = useTexts();

  return (
    <View
      accessible
      accessibilityLabel={texts.mascot.description(
        mascot.level,
        mascot.understood_ideas,
        mascot.ideas_to_next_level,
      )}
      style={styles.card}
    >
      <Pip mood="proud" size={size} />
      <View style={styles.details}>
        <Text style={styles.name}>{texts.mascot.name(mascot.level)}</Text>
        <Text style={styles.progress}>
          {texts.mascot.progress(mascot.understood_ideas, mascot.ideas_to_next_level)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    padding: spacing.medium,
    borderRadius: cornerRadius,
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.large,
  },
  details: {
    flex: 1,
  },
  name: {
    ...textStyles.section,
    color: colors.text,
  },
  progress: {
    ...textStyles.body,
    color: colors.text,
    marginTop: 4,
  },
});
