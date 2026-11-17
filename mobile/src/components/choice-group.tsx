import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minimumTouchSize, pillRadius, spacing } from '@/theme';

type ChoiceGroupProps<Value extends string> = {
  label: string;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
};

/** A row of options where exactly one is picked, announced to screen readers as radio buttons. */
export function ChoiceGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceGroupProps<Value>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected ? styles.selected : null]}
          >
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.small,
    marginBottom: spacing.medium,
  },
  option: {
    flex: 1,
    minHeight: minimumTouchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: pillRadius,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.small,
  },
  selected: {
    borderColor: colors.link,
    borderWidth: 2,
    backgroundColor: colors.dataSoft,
  },
  label: {
    fontSize: 16,
    color: colors.text,
  },
  selectedLabel: {
    fontWeight: '700',
    color: colors.link,
  },
});
