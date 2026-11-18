import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MisconceptionExample, UnitSummary } from '@/api/types';
import { ShareBar } from '@/components/share-bar';
import type { Texts } from '@/i18n/en';
import { useTexts } from '@/i18n/language-context';
import { colors, cornerRadius, minimumTouchSize, panelShadow, spacing, textStyles } from '@/theme';

type SummaryTexts = Texts['unitSummary'];

/** "8 students tried it · on average they explained 64% of the key ideas". */
export function describeUnitReach(unit: UnitSummary, texts: SummaryTexts): string {
  if (unit.students_attempted === 0) {
    return texts.noAttempts;
  }
  const reach = texts.reach(unit.students_attempted);
  if (unit.average_coverage_percent === null) {
    return reach;
  }
  return `${reach} ${texts.average(unit.average_coverage_percent)}`;
}

/** A note about sessions left open past their time, or null when there are none. */
export function describeUnfinished(unit: UnitSummary, texts: SummaryTexts): string | null {
  if (unit.unfinished_sessions === 0) {
    return null;
  }
  return texts.unfinished(unit.unfinished_sessions);
}

function MisconceptionList({ examples }: { examples: MisconceptionExample[] }) {
  const texts = useTexts();

  return (
    <>
      {/* Keys by position, since two students can say exactly the same thing */}
      {examples.map((example, index) => (
        <View key={index} style={styles.example}>
          <Text style={styles.exampleSaid}>“{example.student_said}”</Text>
          <Text style={styles.exampleCorrection}>
            {texts.unitSummary.correctIdea(example.correction)}
          </Text>
        </View>
      ))}
    </>
  );
}

/** One unit across the whole class: how many students explained each key idea, and common mistakes. */
export function UnitSummaryCard({ unit }: { unit: UnitSummary }) {
  const [expanded, setExpanded] = useState(false);
  const texts = useTexts();
  const hasDetails = unit.ideas !== null && unit.students_attempted > 0;
  const unfinishedNote = describeUnfinished(unit, texts.unitSummary);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {unit.title}
      </Text>
      <Text style={styles.reach}>{describeUnitReach(unit, texts.unitSummary)}</Text>
      {unfinishedNote !== null ? <Text style={styles.unfinished}>{unfinishedNote}</Text> : null}

      {hasDetails ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded
              ? texts.unitSummary.hideIdeasFor(unit.title)
              : texts.unitSummary.showIdeasFor(unit.title)
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={styles.toggle}
        >
          <Text style={styles.toggleLabel}>
            {expanded ? texts.unitSummary.hideIdeas : texts.unitSummary.showIdeas}
          </Text>
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
                label={texts.unitSummary.explainedThis}
              />
              {idea.misconception_count > 0 ? (
                <>
                  <Text style={styles.misconceptionCount}>
                    {texts.unitSummary.mistakes(idea.misconception_count)}
                  </Text>
                  <MisconceptionList examples={idea.examples} />
                </>
              ) : null}
            </View>
          ))
        : null}

      {expanded && unit.other_misconceptions.length > 0 ? (
        <View style={styles.idea}>
          <Text style={styles.misconceptionCount}>{texts.unitSummary.otherMistakes}</Text>
          <MisconceptionList examples={unit.other_misconceptions} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    boxShadow: panelShadow,
    borderRadius: cornerRadius,
    padding: spacing.medium,
    marginBottom: spacing.medium,
  },
  title: {
    ...textStyles.section,
    color: colors.text,
  },
  reach: {
    ...textStyles.body,
    color: colors.text,
    marginTop: 4,
  },
  unfinished: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 4,
  },
  toggle: {
    minHeight: minimumTouchSize,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  toggleLabel: {
    ...textStyles.body,
    color: colors.link,
    textDecorationLine: 'underline',
  },
  idea: {
    marginTop: spacing.medium,
  },
  ideaText: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: 6,
  },
  misconceptionCount: {
    ...textStyles.bodyStrong,
    color: colors.text,
    marginTop: spacing.small,
  },
  example: {
    backgroundColor: colors.primarySoft,
    borderRadius: cornerRadius,
    padding: 10,
    marginTop: 6,
  },
  exampleSaid: {
    ...textStyles.body,
    color: colors.text,
    fontStyle: 'italic',
  },
  exampleCorrection: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 2,
  },
});
