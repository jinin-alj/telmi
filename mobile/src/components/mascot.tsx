import { StyleSheet, Text, View } from 'react-native';

import type { Mascot as MascotProgress } from '@/api/types';
import { colors, cornerRadius, spacing } from '@/theme';

const BASE_SIZE = 72;
const GROWTH_PER_LEVEL = 12;
const MAX_SIZE = 140;

/** How big Pip is drawn at a level, so growth is visible but bounded. */
export function mascotSize(level: number): number {
  return Math.min(MAX_SIZE, BASE_SIZE + (level - 1) * GROWTH_PER_LEVEL);
}

/** Pip, drawn as a simple face that grows only from ideas the student has explained. */
export function Mascot({ mascot }: { mascot: MascotProgress }) {
  const size = mascotSize(mascot.level);
  const ideaWord = mascot.ideas_to_next_level === 1 ? 'idea' : 'ideas';

  return (
    <View
      accessible
      accessibilityLabel={`Pip, level ${mascot.level}. ${mascot.understood_ideas} ideas understood. ${mascot.ideas_to_next_level} more to grow.`}
      style={styles.card}
    >
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={styles.eyes}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>
        <View style={styles.smile} />
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>Pip · level {mascot.level}</Text>
        <Text style={styles.progress}>
          {mascot.understood_ideas} ideas understood. Explain {mascot.ideas_to_next_level} more{' '}
          {ideaWord} to help Pip grow.
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
  face: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyes: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  eye: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.onPrimary,
  },
  smile: {
    width: 22,
    height: 11,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    backgroundColor: colors.onPrimary,
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  progress: {
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
  },
});
