import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { ChoiceGroup } from '@/components/choice-group';
import { useTexts } from '@/i18n/language-context';
import { SPEECH_LANGUAGES } from '@/speech/languages';
import type { SpeechLanguage } from '@/speech/languages';
import { colors, minimumTouchSize, spacing, textStyles } from '@/theme';

type SessionSettingsProps = {
  language: SpeechLanguage;
  onLanguageChange: (language: SpeechLanguage) => void;
  voiceOn: boolean;
  onVoiceChange: (voiceOn: boolean) => void;
};

// Browsers draw a teal knob when the switch is on unless told otherwise
const webSwitchColors =
  Platform.OS === 'web' ? ({ activeThumbColor: colors.panel } as object) : null;

/** Which language to listen in, and whether Pip reads replies aloud. */
export function SessionSettings({
  language,
  onLanguageChange,
  voiceOn,
  onVoiceChange,
}: SessionSettingsProps) {
  const texts = useTexts();

  return (
    <View style={styles.container}>
      <ChoiceGroup
        label={texts.settings.speakingLanguage}
        options={SPEECH_LANGUAGES}
        value={language}
        onChange={onLanguageChange}
      />
      <View style={styles.voiceRow}>
        <Text style={styles.voiceLabel}>{texts.settings.voice}</Text>
        <Switch
          accessibilityLabel={texts.settings.voice}
          value={voiceOn}
          onValueChange={onVoiceChange}
          {...webSwitchColors}
          // White on coral is too faint for a switch, so "on" is denim like other selections
          thumbColor={colors.panel}
          trackColor={{ true: colors.link, false: colors.border }}
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
    ...textStyles.body,
    color: colors.text,
  },
});
