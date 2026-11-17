import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MisconceptionExample, UnitSummary } from '@/api/types';
import { ShareBar } from '@/components/share-bar';
import { colors, minimumTouchSize, spacing } from '@/theme';

/** "8 students tried it · on average they explained 64% of the key ideas". */
export function describeUnitReach(unit: UnitSummary): string {
  if (unit.students_attempted === 0) {
    return 'No students have explained this yet.';
  }
  const studentWord = unit.students_attempted === 1 ? 'student has' : 'students have';
  const average =
    unit.average_coverage_percent === null
      ? ''
      : ` On average they explained ${unit.average_coverage_percent}% of the key ideas.`;
  return `${unit.students_attempted} ${studentWord} explained this.${average}`;
}

function MisconceptionList({ examples }: { examples: MisconceptionExample[] }) {
  return (
    <>
      {/* Keys by position, since two students can say exactly the same thing */}
      {examples.map((example, index) => (
        <View key={index} style={styles.example}>
          <Text style={styles.exampleSaid}>“{example.student_said}”</Text>
          <Text style={styles.exampleCorrection}>Correct idea: {example.correction}</Text>
        </View>
      ))}
    </>
  );
}

/** One unit across the whole class: how many students explained each key idea, and common mistakes. */
export function UnitSummaryCard({ unit }: { unit: UnitSummary }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = unit.ideas !== null && unit.students_attempted > 0;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {unit.title}
      </Text>
      <Text style={styles.reach}>{describeUnitReach(unit)}</Text>

      {hasDetails ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? `Hide key ideas for ${unit.title}` : `Show key ideas for ${unit.title}`
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={styles.toggle}
        >
          <Text style={styles.toggleLabel}>{expanded ? 'Hide key ideas' : 'Show key ideas'}</Text>
        </Pressable>
      ) : null}

      {expanded && unit.ideas !== null
        ? unit.ideas.map((idea) => (
            <View key={idea.idea_number} style={styles.idea}>
              <Text style={styles.ideaText}>
                {idea.idea_number}. {idea.idea}
              </Text>
              <ShareBar
                count={idea.students_covered}
                total={idea.students_covered + idea.students_missing}
                label="students explained this"
              />
              {idea.misconception_count > 0 ? (
                <>
                  <Text style={styles.misconceptionCount}>
                    {idea.misconception_count} common{' '}
                    {idea.misconception_count === 1 ? 'mistake' : 'mistakes'}
                  </Text>
                  <MisconceptionList examples={idea.examples} />
                </>
              ) : null}
            </View>
          ))
        : null}

      {expanded && unit.other_misconceptions.length > 0 ? (
        <View style={styles.idea}>
          <Text style={styles.misconceptionCount}>Other mistakes</Text>
          <MisconceptionList examples={unit.other_misconceptions} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  reach: {
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
  },
  toggle: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  toggleLabel: {
    color: colors.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  idea: {
    marginTop: spacing.medium,
  },
  ideaText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
  },
  misconceptionCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
    marginTop: spacing.small,
  },
  example: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
    paddingLeft: 10,
    marginTop: 6,
  },
  exampleSaid: {
    fontSize: 15,
    color: colors.text,
    fontStyle: 'italic',
  },
  exampleCorrection: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
});
