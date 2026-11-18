// Telmi brand v3 (docs/brand-guidelines.md); every text colour meets WCAG 2.1 AA where it's used
export const colors = {
  // Cream page background; the brand never uses a pure white page
  background: '#FFF6EF',
  // White cards, inputs and Pip's speech bubble on the cream page
  panel: '#FFFFFF',
  text: '#3A2540',
  mutedText: '#6E5A6B',
  // Input borders, still 3:1 against white
  border: '#6E5A6B',
  // Pip coral is a fill only, always with ink text on it; as text it is too faint
  primary: '#FF8C69',
  primaryPressed: '#F2734F',
  primarySoft: '#FFE6D8',
  onPrimary: '#3A2540',
  // Denim marks links, selections and spinners
  link: '#3B6699',
  // Denim also marks data: chart bars and "explained" labels, on sky
  data: '#3B6699',
  dataSoft: '#E3ECF7',
  // Rust is the one thing to remember on a screen; never more than one per screen
  emphasis: '#B5462A',
  error: '#B3261E',
  warningSoft: '#FFEDBF',
  // Thin lines between rows inside a panel
  divider: '#F1DED2',
};

// Each name is one font file at one weight (see fonts.ts), so styles never set fontWeight
export const fonts = {
  heading: 'Fredoka_600SemiBold',
  pip: 'Fredoka_500Medium',
  body: 'Figtree_400Regular',
  bodyStrong: 'Figtree_600SemiBold',
};

// The brand's app type scale; nothing is smaller than 14
export const textStyles = {
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  section: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 },
  // Anything Pip says
  pip: { fontFamily: fonts.pip, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodyStrong, fontSize: 17, lineHeight: 24 },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  captionStrong: { fontFamily: fonts.bodyStrong, fontSize: 14, lineHeight: 20 },
};

// The brand's one soft shadow for panels, which have no outlines
export const panelShadow = '0px 18px 44px rgba(58, 37, 64, 0.10)';

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

export const cornerRadius = 16;

// Buttons and chips are fully rounded pills
export const pillRadius = 999;
