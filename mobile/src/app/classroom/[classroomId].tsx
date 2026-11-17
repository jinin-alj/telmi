import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getClassroomDashboard } from '@/api/teaching';
import type { ClassroomDashboard } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { JoinCode } from '@/components/join-code';
import { BackToHome } from '@/components/back-to-home';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { AddUnitForm } from '@/features/teacher/add-unit-form';
import { StudentSummaryRow } from '@/features/teacher/student-summary-row';
import { UnitSummaryCard } from '@/features/teacher/unit-summary-card';
import { useIsWide } from '@/hooks/use-is-wide';
import { colors, cornerRadius, spacing } from '@/theme';

export default function ClassroomScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const [dashboard, setDashboard] = useState<ClassroomDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const isWide = useIsWide();

  const loadDashboard = useCallback(() => {
    getClassroomDashboard(classroomId)
      .then((loaded) => {
        setDashboard(loaded);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : 'Could not load this class.');
      });
  }, [classroomId]);

  useFocusEffect(loadDashboard);

  function handleUnitAdded() {
    setAddingUnit(false);
    loadDashboard();
  }

  return (
    <Screen width="wide" topBar>
      <BackToHome />

      {loadError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {loadError}
        </Text>
      ) : null}
      {dashboard === null && loadError === null ? <Loading label="Loading the class" /> : null}

      {dashboard !== null ? (
        <>
          {/* On wide screens the join code sits beside the title, where it's easy to read out */}
          <Card style={isWide ? styles.header : null}>
            <View>
              <Text accessibilityRole="header" style={styles.title}>
                {dashboard.classroom.name}
              </Text>
              <Text style={styles.subtitle}>
                {dashboard.classroom.subject} · {dashboard.student_count}{' '}
                {dashboard.student_count === 1 ? 'student' : 'students'}
              </Text>
            </View>
            <JoinCode code={dashboard.classroom.join_code} />
          </Card>

          <Text style={styles.notice}>
            Results are checked by AI and can be wrong. Use them to decide where to look, not as
            grades.
          </Text>

          <Columns
            leftShare={3}
            left={
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Units
                </Text>
                {dashboard.units.length === 0 && !addingUnit ? (
                  <Text style={styles.empty}>
                    Add a unit so your students have something to explain.
                  </Text>
                ) : null}
                {dashboard.units.map((unit) => (
                  <UnitSummaryCard key={unit.unit_id} unit={unit} />
                ))}
                {addingUnit ? (
                  <AddUnitForm
                    classroomId={dashboard.classroom.id}
                    onAdded={handleUnitAdded}
                    onCancel={() => setAddingUnit(false)}
                  />
                ) : (
                  <Button label="Add a unit" onPress={() => setAddingUnit(true)} />
                )}
              </>
            }
            rightShare={2}
            right={
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Students
                </Text>
                {dashboard.students.length === 0 ? (
                  <Text style={styles.empty}>
                    No students yet. Share the join code {dashboard.classroom.join_code} with your
                    class.
                  </Text>
                ) : null}
                {dashboard.students.length > 0 ? (
                  <Card style={styles.studentList}>
                    {dashboard.students.map((student) => (
                      <StudentSummaryRow
                        key={student.student_id}
                        student={student}
                        units={dashboard.units}
                      />
                    ))}
                  </Card>
                ) : null}
              </>
            }
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedText,
    marginBottom: spacing.medium,
  },
  notice: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.warningSoft,
    borderRadius: cornerRadius,
    padding: spacing.small,
    marginTop: spacing.medium,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  empty: {
    fontSize: 16,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginVertical: spacing.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.small,
  },
  studentList: {
    paddingVertical: 0,
  },
});
