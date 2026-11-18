import { StyleSheet, Text, View } from 'react-native';

import type { UnitProgress } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { useIsWide } from '@/hooks/use-is-wide';
import type { Texts } from '@/i18n/en';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

/** One line summarising how the student did last time, in ideas rather than a score. */
export function describeLastAttempt(unit: UnitProgress, texts: Texts['unitRow']): string {
  if (unit.sessions_completed === 0) {
    return texts.notYet;
  }
  if (unit.total_ideas === null) {
    return texts.explainedTimes(unit.sessions_completed);
  }
  const explainedNow = unit.total_ideas - unit.still_missing.length;
  return texts.lastTime(explainedNow, unit.total_ideas);
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
  const texts = useTexts();

  return (
    <Card style={isWide ? styles.tile : styles.row}>
      <Text style={styles.title}>{unit.title}</Text>
      <Text style={styles.summary}>{describeLastAttempt(unit, texts.unitRow)}</Text>
      {unit.next_step ? (
        <Text style={styles.nextStep}>{texts.unitRow.next(unit.next_step)}</Text>
      ) : null}
      {/* Cards in a row share one height, so the buttons line up along the bottom */}
      <View style={isWide ? styles.bottom : null}>
        <Button
          label={texts.unitRow.explain(unit.title)}
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
    borderTopColor: colors.divider,
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
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  summary: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 2,
  },
  nextStep: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.small,
  },
});
