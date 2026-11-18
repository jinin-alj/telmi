import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { useTexts } from '@/i18n/language-context';
import { colors, minimumTouchSize, spacing, textStyles } from '@/theme';

type SessionSettingsProps = {
  voiceOn: boolean;
  onVoiceChange: (voiceOn: boolean) => void;
};

// Browsers draw a teal knob when the switch is on unless told otherwise
const webSwitchColors =
  Platform.OS === 'web' ? ({ activeThumbColor: colors.panel } as object) : null;

/** Whether Pip reads its replies aloud; the language comes from the switch at the foot of the page. */
export function SessionSettings({ voiceOn, onVoiceChange }: SessionSettingsProps) {
  const texts = useTexts();

  return (
    <View style={styles.container}>
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
