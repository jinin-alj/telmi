import { ActivityIndicator } from 'react-native';

import { SlowRequestNotice } from '@/components/slow-request-notice';
import { colors } from '@/theme';

/** A page's loading spinner, which explains itself if the free server is slow to wake up. */
export function Loading({ label }: { label: string }) {
  return (
    <>
      <ActivityIndicator accessibilityLabel={label} color={colors.primary} />
      <SlowRequestNotice waiting />
    </>
  );
}
