import { StyleSheet, Text, View } from 'react-native';

import type { UnitProgress } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { useIsWide } from '@/hooks/use-is-wide';
import { colors, spacing } from '@/theme';

/** One line summarising how the student did last time, in ideas rather than a score. */
export function describeLastAttempt(unit: UnitProgress): string {
  if (unit.sessions_completed === 0) {
    return 'Not explained yet';
  }
  if (unit.total_ideas === null) {
    return `Explained ${unit.sessions_completed} time${unit.sessions_completed === 1 ? '' : 's'}`;
  }
  const explainedNow = unit.total_ideas - unit.still_missing.length;
  return `Last time: ${explainedNow} of ${unit.total_ideas} key ideas`;
}

type UnitRowProps = {
  unit: UnitProgress;
  starting: boolean;
  disabled: boolean;
  onStart: () => void;
};

/** A unit the student can explain, with last time's result and suggested next step. */
export function UnitRow({ unit, starting, disabled, onStart }: UnitRowProps) {
  const isWide = useIsWide();
  return (
    <Card style={isWide ? styles.tile : styles.row}>
      <Text style={styles.title}>{unit.title}</Text>
      <Text style={styles.summary}>{describeLastAttempt(unit)}</Text>
      {unit.next_step ? <Text style={styles.nextStep}>Next: {unit.next_step}</Text> : null}
      {/* Cards in a row share one height, so the buttons line up along the bottom */}
      <View style={isWide ? styles.bottom : null}>
        <Button
          label={`Explain ${unit.title}`}
          onPress={onStart}
          loading={starting}
          disabled={disabled}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  tile: {
    flexBasis: 260,
    flexGrow: 1,
    gap: spacing.small,
  },
  bottom: {
    marginTop: 'auto',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  summary: {
    fontSize: 15,
    color: colors.mutedText,
    marginTop: 2,
  },
  nextStep: {
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.small,
  },
});
