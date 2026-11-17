import { StyleSheet, Text, View } from 'react-native';

import type { StudentSummary, StudentUnitResult, UnitSummary } from '@/api/types';
import { colors, spacing } from '@/theme';

/** "4 of 6 key ideas" for one student on one unit, or why there's no result yet. */
export function describeStudentResult(result: StudentUnitResult, unit: UnitSummary): string {
  if (result.sessions_completed === 0) {
    return 'Not explained yet';
  }
  if (unit.ideas === null) {
    return `${result.latest_coverage_percent ?? 0}% of key ideas`;
  }
  const total = unit.ideas.length;
  return `${total - result.missing_ideas.length} of ${total} key ideas`;
}

type StudentSummaryRowProps = {
  student: StudentSummary;
  units: UnitSummary[];
};

/** One student's latest result on every unit, with the ideas still missing. Never a rank. */
export function StudentSummaryRow({ student, units }: StudentSummaryRowProps) {
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
              {unit.title}: {describeStudentResult(result, unit)}
            </Text>
            {result.missing_ideas.length > 0 ? (
              <>
                <Text style={styles.missing}>Still to explain:</Text>
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
    borderTopColor: colors.surface,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  username: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.mutedText,
  },
  unit: {
    marginTop: 6,
  },
  unitLine: {
    fontSize: 15,
    color: colors.text,
  },
  missing: {
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
});
