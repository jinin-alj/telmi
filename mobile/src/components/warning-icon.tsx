import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/** A red circle with an exclamation mark that goes beside error words; screen readers skip it. */
export function WarningIcon({ size }: { size: number }) {
  return (
    <View
      testID="warning-icon"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11} fill={colors.error} />
        <Path d="M12 6.5v7" stroke={colors.panel} strokeWidth={2.5} strokeLinecap="round" />
        <Circle cx={12} cy={17.5} r={1.5} fill={colors.panel} />
      </Svg>
    </View>
  );
}
