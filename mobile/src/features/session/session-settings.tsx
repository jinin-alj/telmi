import { StyleSheet, Switch, Text, View } from 'react-native';

import { ChoiceGroup } from '@/components/choice-group';
import { SPEECH_LANGUAGES } from '@/speech/languages';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, minimumTouchSize, spacing } from '@/theme';

type SessionSettingsProps = {
  language: SpeechLanguage;
  onLanguageChange: (language: SpeechLanguage) => void;
  voiceOn: boolean;
  onVoiceChange: (voiceOn: boolean) => void;
};

/** Which language to listen in, and whether Pip reads replies aloud. */
export function SessionSettings({
  language,
  onLanguageChange,
  voiceOn,
  onVoiceChange,
}: SessionSettingsProps) {
  return (
    <View style={styles.container}>
      <ChoiceGroup
        label="Language you are speaking"
        options={SPEECH_LANGUAGES}
        value={language}
        onChange={onLanguageChange}
      />
      <View style={styles.voiceRow}>
        <Text style={styles.voiceLabel}>Pip speaks out loud</Text>
        <Switch
          accessibilityLabel="Pip speaks out loud"
          value={voiceOn}
          onValueChange={onVoiceChange}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.large,
    paddingTop: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  voiceRow: {
    minHeight: minimumTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceLabel: {
    fontSize: 16,
    color: colors.text,
  },
});
