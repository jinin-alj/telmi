import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { joinClassroom } from '@/api/study';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { errorText } from '@/i18n/error-text';
import { useTexts } from '@/i18n/language-context';
import { colors, spacing, textStyles } from '@/theme';

/** Join a class with the six-character code the teacher shared. */
export function JoinClassForm({ onJoined }: { onJoined: () => void }) {
  const texts = useTexts();
  const [joinCode, setJoinCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const cleanedCode = joinCode.replace(/\s/g, '').toUpperCase();
    if (cleanedCode.length < 6) {
      setErrorMessage(texts.joinClass.tooShort);
      return;
    }
    setErrorMessage(null);
    setJoining(true);
    try {
      await joinClassroom(cleanedCode);
      setJoinCode('');
      onJoined();
    } catch (error) {
      setErrorMessage(errorText(error, texts, texts.joinClass.failed));
    } finally {
      setJoining(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        {texts.joinClass.heading}
      </Text>
      <TextField
        label={texts.joinClass.label}
        hint={texts.joinClass.hint}
        error={errorMessage}
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        onSubmitEditing={handleJoin}
      />
      <Button
        label={texts.joinClass.submit}
        variant="secondary"
        onPress={handleJoin}
        loading={joining}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyles.section,
    color: colors.text,
    marginBottom: spacing.small,
  },
});
