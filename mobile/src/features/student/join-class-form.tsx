import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { joinClassroom } from '@/api/study';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { colors, spacing } from '@/theme';

/** Join a class with the six-character code the teacher shared. */
export function JoinClassForm({ onJoined }: { onJoined: () => void }) {
  const [joinCode, setJoinCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const cleanedCode = joinCode.replace(/\s/g, '').toUpperCase();
    if (cleanedCode.length < 6) {
      setErrorMessage('Join codes have 6 characters.');
      return;
    }
    setErrorMessage(null);
    setJoining(true);
    try {
      await joinClassroom(cleanedCode);
      setJoinCode('');
      onJoined();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Could not join that class.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        Join a class
      </Text>
      <TextField
        label="Join code"
        hint="Ask your teacher for the 6-character code."
        error={errorMessage}
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        onSubmitEditing={handleJoin}
      />
      <Button label="Join class" variant="secondary" onPress={handleJoin} loading={joining} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.small,
  },
});
