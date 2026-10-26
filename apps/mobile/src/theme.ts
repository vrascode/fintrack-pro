import { useColorScheme } from 'react-native';
import { usePreferences } from './preferences';

export const palettes = {
  light: {
    background: '#F6F5F0',
    surface: '#FFFFFF',
    ink: '#172E31',
    muted: '#53696A',
    border: '#DCE4DE',
    accent: '#146954',
    tint: '#E6F3EC',
    danger: '#A32929',
  },
  dark: {
    background: '#101E21',
    surface: '#1A2D30',
    ink: '#F0F4ED',
    muted: '#ADC0BB',
    border: '#395153',
    accent: '#9DE3BF',
    tint: '#27463D',
    danger: '#FFACAC',
  },
};
export function useTheme() {
  const system = useColorScheme();
  const { value } = usePreferences();
  const mode = value.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : value.theme;
  return { ...palettes[mode], mode };
}
