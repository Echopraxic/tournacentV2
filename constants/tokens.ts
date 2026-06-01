// Design tokens — TypeScript source of truth.
// Mirrors tournacent_react_native_component_kit.jsx so the two stay in sync.

export const tokens = {
  colors: {
    dark: {
      background: '#0B0F14',
      surface:    '#121821',
      primary:    '#00E38C',
      text:       '#FFFFFF',
      subtext:    '#8A94A6',
      danger:     '#FF5C5C',
    },
    light: {
      background: '#F7F9FC',
      surface:    '#FFFFFF',
      primary:    '#00A86B',
      text:       '#0F172A',
      subtext:    '#5B6472',
      danger:     '#DC2626',
    },
  },
  spacing: [4, 8, 12, 16, 20, 24, 32] as const,
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
  },
} as const;

export type ColorMode = keyof typeof tokens.colors;
export type ThemeColors = { [K in keyof typeof tokens.colors.light]: string };
