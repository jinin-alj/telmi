import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { listClassrooms } from '@/api/teaching';
import type { Classroom, User } from '@/api/types';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Columns } from '@/components/columns';
import { JoinCode } from '@/components/join-code';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { CreateClassForm } from '@/features/teacher/create-class-form';
import { useIsWide } from '@/hooks/use-is-wide';
import { colors, spacing } from '@/theme';

type TeacherHomeProps = {
  user: User;
  onSignOut: () => void;
};

/** The teacher's classes with their join codes, and a form to create another. */
export function TeacherHome({ user, onSignOut }: TeacherHomeProps) {
  const isWide = useIsWide();
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadClassrooms = useCallback(() => {
    listClassrooms()
      .then((loaded) => {
        setClassrooms(loaded);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Could not load your classes.');
      });
  }, []);

  useFocusEffect(loadClassrooms);

  function openClassroom(classroomId: string) {
    router.push({ pathname: '/classroom/[classroomId]', params: { classroomId } });
  }

  const classList = (
    <>
      {classrooms !== null && classrooms.length === 0 ? (
        <Text style={styles.empty}>
          Create your first class, then share its join code with your students.
        </Text>
      ) : null}

      <View style={isWide ? styles.grid : null}>
        {classrooms?.map((classroom) => (
          <Card key={classroom.id} style={isWide ? styles.gridItem : styles.classroom}>
            <Text style={styles.classroomName}>{classroom.name}</Text>
            <Text style={styles.subject}>{classroom.subject}</Text>
            <JoinCode code={classroom.join_code} />
            <Button
              label={`Open ${classroom.name}`}
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
        Hi, {user.display_name}
      </Text>

      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
      {classrooms === null && errorMessage === null ? (
        <Loading label="Loading your classes" />
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
          <Button label="Sign out" variant="secondary" onPress={onSignOut} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginBottom: spacing.medium,
  },
  empty: {
    fontSize: 16,
    color: colors.mutedText,
  },
  classroom: {
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: spacing.small,
  },
  classroomName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subject: {
    fontSize: 15,
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
