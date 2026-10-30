import { Platform, useColorScheme } from 'react-native';
import { usePreferences } from './preferences';

export const designTokens = Object.freeze({
  brand: { orange: '#FF5A00', orangeInteraction: '#FF741F' },
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
    background: '#F2EFE9',
    sidebar: '#FAF8F4',
    surface: '#FAF8F4',
    elevated: '#EAE5DC',
    border: '#D9D3C9',
    ink: '#171717',
    muted: '#625F5A',
    accent: '#BA3B00',
    accentStrong: '#FF5A00',
    accentSoft: '#FBE5D9',
    accentInk: '#FFFFFF',
    positive: '#207A4B',
    negative: '#B42318',
    warning: '#8A5700',
    danger: '#B42318',
    shadow: 'rgba(35, 25, 18, 0.08)',
  },
  dark: {
    background: '#0A0A0A',
    sidebar: '#101010',
    surface: '#141414',
    elevated: '#1C1C1C',
    border: '#292929',
    ink: '#F5F5F5',
    muted: '#A3A3A3',
    accent: '#FF5A00',
    accentStrong: '#FF741F',
    accentSoft: '#382115',
    accentInk: '#171717',
    positive: '#52D98A',
    negative: '#FF7770',
    warning: '#F5C76B',
    danger: '#FF7770',
    shadow: 'rgba(0, 0, 0, 0.28)',
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
