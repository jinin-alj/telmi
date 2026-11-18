import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getClassroomDashboard } from '@/api/teaching';
import type { ClassroomDashboard } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { ErrorMessage } from '@/components/error-message';
import { JoinCode } from '@/components/join-code';
import { BackToHome } from '@/components/back-to-home';
import { Loading } from '@/components/loading';
import { PipNote } from '@/components/pip-note';
import { Screen } from '@/components/screen';
import { AddUnitForm } from '@/features/teacher/add-unit-form';
import { StudentSummaryRow } from '@/features/teacher/student-summary-row';
import { UnitSummaryCard } from '@/features/teacher/unit-summary-card';
import { useIsWide } from '@/hooks/use-is-wide';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, cornerRadius, spacing, textStyles } from '@/theme';

export default function ClassroomScreen() {
  const { classroomId } = useLocalSearchParams<{ classroomId: string }>();
  const [dashboard, setDashboard] = useState<ClassroomDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const isWide = useIsWide();
  const texts = useTexts();

  const loadDashboard = useCallback(() => {
    getClassroomDashboard(classroomId)
      .then((loaded) => {
        setDashboard(loaded);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(errorText(error, texts, texts.classroom.loadFailed));
      });
  }, [classroomId, texts]);

  useFocusEffect(loadDashboard);

  function handleUnitAdded() {
    setAddingUnit(false);
    loadDashboard();
  }

  return (
    <Screen width="wide" topBar>
      <BackToHome />

      <ErrorMessage message={loadError} style={styles.error} />
      {dashboard === null && loadError === null ? (
        <Loading label={texts.classroom.loading} />
      ) : null}

      {dashboard !== null ? (
        <>
          {/* On wide screens the join code sits beside the title, where it's easy to read out */}
          <Card style={isWide ? styles.header : null}>
            <View>
              <Text accessibilityRole="header" style={styles.title}>
                {dashboard.classroom.name}
              </Text>
              <Text style={styles.subtitle}>
                {dashboard.classroom.subject} ·{' '}
                {texts.classroom.studentCount(dashboard.student_count)}
              </Text>
            </View>
            <JoinCode code={dashboard.classroom.join_code} />
          </Card>

          <Text style={styles.notice}>{texts.classroom.aiNotice}</Text>

          <Columns
            leftShare={3}
            left={
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {texts.classroom.units}
                </Text>
                {dashboard.units.length === 0 && !addingUnit ? (
                  <PipNote mood="curious">
                    <Text style={styles.empty}>{texts.classroom.noUnits}</Text>
                  </PipNote>
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
                  <Button label={texts.classroom.addUnit} onPress={() => setAddingUnit(true)} />
                )}
              </>
            }
            rightShare={2}
            right={
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {texts.classroom.students}
                </Text>
                {dashboard.students.length === 0 ? (
                  <PipNote mood="curious">
                    <Text style={styles.empty}>
                      {texts.classroom.noStudents(dashboard.classroom.join_code)}
                    </Text>
                  </PipNote>
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
    ...textStyles.title,
    color: colors.text,
  },
  subtitle: {
    ...textStyles.body,
    color: colors.mutedText,
    marginBottom: spacing.medium,
  },
  notice: {
    ...textStyles.body,
    color: colors.text,
    backgroundColor: colors.warningSoft,
    borderRadius: cornerRadius,
    padding: spacing.small,
    marginTop: spacing.medium,
  },
  sectionTitle: {
    ...textStyles.section,
    color: colors.text,
    marginTop: spacing.large,
    marginBottom: spacing.small,
  },
  empty: {
    ...textStyles.body,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  error: {
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
