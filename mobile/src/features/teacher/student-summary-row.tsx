import { StyleSheet, Text, View } from 'react-native';

import type { StudentSummary, StudentUnitResult, UnitSummary } from '@/api/types';
import type { Texts } from '@/i18n/en';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

/** "4 of 6 key ideas" for one student on one unit, or why there's no result yet. */
export function describeStudentResult(
  result: StudentUnitResult,
  unit: UnitSummary,
  texts: Texts['studentRow'],
): string {
  if (result.sessions_completed === 0) {
    return texts.notYet;
  }
  if (unit.ideas === null) {
    return texts.percentOfIdeas(result.latest_coverage_percent ?? 0);
  }
  const total = unit.ideas.length;
  return texts.ideasOf(total - result.missing_ideas.length, total);
}

type StudentSummaryRowProps = {
  student: StudentSummary;
  units: UnitSummary[];
};

/** One student's latest result on every unit, with the ideas still missing. Never a rank. */
export function StudentSummaryRow({ student, units }: StudentSummaryRowProps) {
  const texts = useTexts();

  return (
    <View style={styles.row}>
      <Text style={styles.name}>
        {student.display_name} <Text style={styles.username}>@{student.username}</Text>
      </Text>
      {student.units.map((result) => {
        const unit = units.find((candidate) => candidate.unit_id === result.unit_id);
        if (unit === undefined) {
          return null;
        }
        return (
          <View key={result.unit_id} style={styles.unit}>
            <Text style={styles.unitLine}>
              {unit.title}: {describeStudentResult(result, unit, texts.studentRow)}
            </Text>
            {result.missing_ideas.length > 0 ? (
              <>
                <Text style={styles.missing}>{texts.studentRow.stillToExplain}</Text>
                {/* Keys by position, since the checker can repeat the same text */}
                {result.missing_ideas.map((idea, index) => (
                  <Text key={index} style={styles.missing}>
                    • {idea}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  name: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  username: {
    ...textStyles.caption,
    color: colors.mutedText,
  },
  unit: {
    marginTop: 6,
  },
  unitLine: {
    ...textStyles.body,
    color: colors.text,
  },
  missing: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginTop: 2,
  },
});
