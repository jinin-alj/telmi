import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { listClassrooms } from '@/api/teaching';
import type { Classroom, User } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { ErrorMessage } from '@/components/error-message';
import { JoinCode } from '@/components/join-code';
import { Loading } from '@/components/loading';
import { PipNote } from '@/components/pip-note';
import { Screen } from '@/components/screen';
import { CreateClassForm } from '@/features/teacher/create-class-form';
import { useIsWide } from '@/hooks/use-is-wide';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

type TeacherHomeProps = {
  user: User;
  onSignOut: () => void;
};

/** The teacher's classes with their join codes, and a form to create another. */
export function TeacherHome({ user, onSignOut }: TeacherHomeProps) {
  const isWide = useIsWide();
  const texts = useTexts();
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadClassrooms = useCallback(() => {
    listClassrooms()
      .then((loaded) => {
        setClassrooms(loaded);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        setErrorMessage(errorText(error, texts, texts.teacherHome.loadFailed));
      });
  }, [texts]);

  useFocusEffect(loadClassrooms);

  function openClassroom(classroomId: string) {
    router.push({ pathname: '/classroom/[classroomId]', params: { classroomId } });
  }

  const classList = (
    <>
      {classrooms !== null && classrooms.length === 0 ? (
        <PipNote mood="curious">
          <Text style={styles.empty}>{texts.teacherHome.empty}</Text>
        </PipNote>
      ) : null}

      <View style={isWide ? styles.grid : null}>
        {classrooms?.map((classroom) => (
          <Card key={classroom.id} style={isWide ? styles.gridItem : styles.classroom}>
            <Text style={styles.classroomName}>{classroom.name}</Text>
            <Text style={styles.subject}>{classroom.subject}</Text>
            <JoinCode code={classroom.join_code} />
            <Button
              label={texts.teacherHome.open(classroom.name)}
              variant="secondary"
              onPress={() => openClassroom(classroom.id)}
            />
          </Card>
        ))}
      </View>
    </>
  );

  return (
    <Screen width="wide" topBar>
      <Text accessibilityRole="header" style={styles.title}>
        {texts.teacherHome.greeting(user.display_name)}
      </Text>

      <ErrorMessage message={errorMessage} style={styles.error} />
      {classrooms === null && errorMessage === null ? (
        <Loading label={texts.teacherHome.loading} />
      ) : null}

      <Columns
        left={classList}
        leftShare={2}
        right={
          <Card style={isWide ? null : styles.createClass}>
            <CreateClassForm onCreated={(classroom) => openClassroom(classroom.id)} />
          </Card>
        }
        rightShare={1}
      />

      {/* On wide screens the top bar has Sign out */}
      {!isWide ? (
        <View style={styles.signOut}>
          <Button label={texts.nav.signOut} variant="secondary" onPress={onSignOut} />
        </View>
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
  },
  classroom: {
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.small,
  },
  classroomName: {
    ...textStyles.section,
    color: colors.text,
  },
  subject: {
    ...textStyles.caption,
    color: colors.mutedText,
  },
  signOut: {
    marginTop: spacing.large,
  },
  createClass: {
    marginTop: spacing.large,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.medium,
  },
  gridItem: {
    flexBasis: 280,
    flexGrow: 1,
    gap: spacing.small,
  },
});
