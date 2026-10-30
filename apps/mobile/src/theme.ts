import { Platform, useColorScheme } from 'react-native';
import { usePreferences } from './preferences';

export const designTokens = Object.freeze({
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  typography: {
    family: Platform.OS === 'web' ? 'Inter, ui-sans-serif, system-ui, sans-serif' : undefined,
    sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, display: 34 },
  },
  breakpoints: { tablet: 700, desktop: 1080, wide: 1440 },
});

export const palettes = {
  light: {
    background: '#F5F7F4',
    sidebar: '#FFFFFF',
    surface: '#FFFFFF',
    elevated: '#EBF0E9',
    border: '#DCE5DC',
    ink: '#172019',
    muted: '#657167',
    accent: '#277A43',
    accentStrong: '#398B34',
    accentSoft: '#E8F3E8',
    accentInk: '#FFFFFF',
    positive: '#277A43',
    negative: '#B83F4A',
    warning: '#8A5A08',
    danger: '#B83F4A',
    shadow: 'rgba(28, 48, 31, 0.08)',
  },
  dark: {
    background: '#090B0A',
    sidebar: '#0D100E',
    surface: '#191E1B',
    elevated: '#222923',
    border: '#2B332D',
    ink: '#F5F8F5',
    muted: '#9BA79E',
    accent: '#B6FF5C',
    accentStrong: '#77D63B',
    accentSoft: '#1B3322',
    accentInk: '#14200E',
    positive: '#52D98A',
    negative: '#F07178',
    warning: '#F5C76B',
    danger: '#F07178',
    shadow: 'rgba(0, 0, 0, 0.24)',
  },
} as const;

export type ThemeMode = keyof typeof palettes;
export type ThemeColors = (typeof palettes)[ThemeMode];

export function useTheme() {
  const system = useColorScheme();
  const { value } = usePreferences();
  const mode: ThemeMode =
    value.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : value.theme;
  return { ...palettes[mode], mode, preference: value.theme };
}
