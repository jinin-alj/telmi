// Every text colour here meets WCAG 2.1 AA contrast (4.5:1 or more) on the background it's used on
export const colors = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  mutedText: '#4B5563',
  border: '#6B7280',
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  onPrimary: '#FFFFFF',
  error: '#B91C1C',
  success: '#047857',
  successSoft: '#D1FAE5',
  warningSoft: '#FEF3C7',
  // Only outlines panels on the grey desktop background; no text is drawn in it
  divider: '#E5E7EB',
};

export const spacing = {
  small: 8,
  medium: 16,
  large: 24,
};

// 44 points is the smallest comfortable touch target on iOS and Android
export const minimumTouchSize = 44;

// Browser windows at least this wide get the desktop layout; phones and tablets in portrait don't
export const wideScreenWidth = 900;

// Forms stay narrow so lines are easy to read; dashboards and sessions use the extra room
export const contentWidth = {
  narrow: 480,
  wide: 1120,
};

export const cornerRadius = 12;
