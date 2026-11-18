import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getMyProgress, startSession } from '@/api/study';
import type { StudentProgress, User } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { ErrorMessage } from '@/components/error-message';
import { Mascot } from '@/components/mascot';
import { PipNote } from '@/components/pip-note';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { JoinClassForm } from '@/features/student/join-class-form';
import { UnitRow } from '@/features/student/unit-row';
import { useIsWide } from '@/hooks/use-is-wide';
import { errorText } from '@/i18n/error-text';
import { useLanguage, useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

type StudentHomeProps = {
  user: User;
  onSignOut: () => void;
};

/** The student's classes, units and Pip, refreshed every time the screen comes back into view. */
export function StudentHome({ user, onSignOut }: StudentHomeProps) {
  const isWide = useIsWide();
  const texts = useTexts();
  const { language } = useLanguage();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startingUnitId, setStartingUnitId] = useState<string | null>(null);
  // A ref rather than state, so a second tap in the same moment already sees it
  const startingSession = useRef(false);

  const loadProgress = useCallback(() => {
    getMyProgress()
      .then((loaded) => {
        setProgress(loaded);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        setErrorMessage(errorText(error, texts, texts.studentHome.loadFailed));
      });
  }, [texts]);

  // Reload when returning from a session so Pip and last results are up to date
  useFocusEffect(loadProgress);

  async function handleStart(unitId: string) {
    // One session at a time; a second tap would open two screens
    if (startingSession.current) {
      return;
    }
    startingSession.current = true;
    setStartingUnitId(unitId);
    try {
      const session = await startSession(unitId, language);
      router.push({ pathname: '/session/[sessionId]', params: { sessionId: session.id } });
    } catch (error) {
      setErrorMessage(errorText(error, texts, texts.studentHome.startFailed));
    } finally {
      startingSession.current = false;
      setStartingUnitId(null);
    }
  }

  return (
    <Screen width="wide" topBar>
      <Text accessibilityRole="header" style={styles.title}>
        {texts.studentHome.greeting(user.display_name)}
      </Text>

      <ErrorMessage message={errorMessage} style={styles.error} />

      {progress === null && errorMessage === null ? (
        <Loading label={texts.studentHome.loading} />
      ) : null}

      {progress !== null ? (
        <>
          <Mascot mascot={progress.mascot} />

          <Columns
            leftShare={2}
            left={
              <>
                {progress.classrooms.length === 0 ? (
                  <PipNote mood="curious">
                    <Text style={styles.empty}>{texts.studentHome.noClasses}</Text>
                  </PipNote>
                ) : null}

                {progress.classrooms.map((entry) => (
                  <View key={entry.classroom.id} style={styles.classroom}>
                    <Text accessibilityRole="header" style={styles.classroomName}>
                      {entry.classroom.name}
                    </Text>
                    <Text style={styles.subject}>{entry.classroom.subject}</Text>
                    {entry.units.length === 0 ? (
                      <PipNote mood="curious">
                        <Text style={styles.empty}>{texts.studentHome.noUnits}</Text>
                      </PipNote>
                    ) : null}
                    <View style={isWide ? styles.unitGrid : null}>
                      {entry.units.map((unit) => (
                        <UnitRow
                          key={unit.unit_id}
                          unit={unit}
                          starting={startingUnitId === unit.unit_id}
                          disabled={startingUnitId !== null}
                          onStart={() => handleStart(unit.unit_id)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </>
            }
            rightShare={1}
            right={
              <Card style={isWide ? null : styles.joinClass}>
                <JoinClassForm onJoined={loadProgress} />
              </Card>
            }
          />
        </>
      ) : null}

      {/* On wide screens the top bar has Sign out */}
      {!isWide ? (
        <Button label={texts.nav.signOut} variant="secondary" onPress={onSignOut} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...textStyles.title,
    color: colors.text,
    marginBottom: spacing.medium,
  },
  error: {
    marginBottom: spacing.medium,
  },
  empty: {
    ...textStyles.body,
    color: colors.mutedText,
    marginVertical: spacing.small,
  },
  classroom: {
    marginBottom: spacing.large,
  },
  classroomName: {
    ...textStyles.section,
    color: colors.text,
  },
  subject: {
    ...textStyles.caption,
    color: colors.mutedText,
    marginBottom: spacing.small,
  },
  joinClass: {
    marginTop: spacing.large,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.medium,
    marginTop: spacing.small,
  },
});
