import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { createClassroom } from '@/api/teaching';
import type { Classroom } from '@/api/types';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { TextField } from '@/components/text-field';
import { validateClassName, validateSubject } from '@/features/teacher/validation';
import { colors, spacing, textStyles } from '@/theme';

/** Create a class; the new class and its join code appear in the list straight away. */
export function CreateClassForm({ onCreated }: { onCreated: (classroom: Classroom) => void }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const nextNameError = validateClassName(name);
    const nextSubjectError = validateSubject(subject);
    setNameError(nextNameError);
    setSubjectError(nextSubjectError);
    setFormError(null);
    if (nextNameError || nextSubjectError) {
      return;
    }

    setCreating(true);
    try {
      const classroom = await createClassroom(name.trim(), subject.trim());
      setName('');
      setSubject('');
      onCreated(classroom);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not create the class.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        Create a class
      </Text>
      <TextField
        label="Class name"
        hint="For example, Biology 3A."
        error={nameError}
        value={name}
        onChangeText={setName}
      />
      <TextField label="Subject" error={subjectError} value={subject} onChangeText={setSubject} />
      <ErrorMessage message={formError} style={styles.error} />
      <Button label="Create class" onPress={handleCreate} loading={creating} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyles.section,
    color: colors.text,
    marginBottom: spacing.small,
  },
  error: {
    marginBottom: spacing.small,
  },
});
