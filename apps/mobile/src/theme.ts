import { Platform, useColorScheme } from 'react-native';
import { usePreferences } from './preferences';
import { palettes } from './theme-colors';

export { palettes } from './theme-colors';

export const designTokens = Object.freeze({
  brand: { orange: '#C84A01', orangeInteraction: '#E45A12' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: {
    family: Platform.OS === 'web' ? 'Inter, ui-sans-serif, system-ui, sans-serif' : undefined,
    sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, display: 34 },
  },
  breakpoints: { tablet: 700, desktop: 1080, wide: 1440 },
});

export type ThemeMode = keyof typeof palettes;
export type ThemeColors = (typeof palettes)[ThemeMode];

export function useTheme() {
  const system = useColorScheme();
  const { value } = usePreferences();
  const mode: ThemeMode =
    value.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : value.theme;
  return { ...palettes[mode], mode, preference: value.theme };
}
