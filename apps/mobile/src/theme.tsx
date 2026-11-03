import { Platform, useColorScheme } from 'react-native';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { usePreferences } from './preferences';
import { brandColors, palettes } from './theme-colors';

export { palettes } from './theme-colors';

export const designTokens = Object.freeze({
  brand: brandColors,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: {
    family: Platform.OS === 'web' ? 'Inter, ui-sans-serif, system-ui, sans-serif' : undefined,
    sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, display: 34 },
  },
  breakpoints: { tablet: 700, desktop: 1080, wide: 1440 },
});

export type ThemeMode = keyof typeof palettes;
export type ThemeColors = { [K in keyof (typeof palettes)['light']]: string };
const ThemeContext = createContext<Partial<ThemeColors>>({});

export function ThemeScope({
  colors,
  children,
}: PropsWithChildren<{ colors: Partial<ThemeColors> }>) {
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const system = useColorScheme();
  const { value } = usePreferences();
  const mode: ThemeMode =
    value.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : value.theme;
  const overrides = useContext(ThemeContext);
  return { ...palettes[mode], ...overrides, mode, preference: value.theme };
}
