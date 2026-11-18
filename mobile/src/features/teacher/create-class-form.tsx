import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { createClassroom } from '@/api/teaching';
import type { Classroom } from '@/api/types';
import { Button } from '@/components/button';
import { ErrorMessage } from '@/components/error-message';
import { TextField } from '@/components/text-field';
import { validateClassName, validateSubject } from '@/features/teacher/validation';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

/** Create a class; the new class and its join code appear in the list straight away. */
export function CreateClassForm({ onCreated }: { onCreated: (classroom: Classroom) => void }) {
  const texts = useTexts();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const nextNameError = validateClassName(name, texts);
    const nextSubjectError = validateSubject(subject, texts);
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
      setFormError(errorText(error, texts, texts.createClass.failed));
    } finally {
      setCreating(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        {texts.createClass.heading}
      </Text>
      <TextField
        label={texts.createClass.name}
        hint={texts.createClass.nameHint}
        error={nameError}
        value={name}
        onChangeText={setName}
      />
      <TextField
        label={texts.createClass.subject}
        error={subjectError}
        value={subject}
        onChangeText={setSubject}
      />
      <ErrorMessage message={formError} style={styles.error} />
      <Button label={texts.createClass.submit} onPress={handleCreate} loading={creating} />
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
