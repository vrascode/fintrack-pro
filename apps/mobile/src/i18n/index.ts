import { usePreferences } from '../preferences';
import en from './en';
import ptBR from './pt-BR';

export type TranslationKey = keyof typeof ptBR;
const dictionaries = { 'pt-BR': ptBR, en } as const;

export function translate(language: 'pt-BR' | 'en', key: TranslationKey): string {
  return dictionaries[language][key];
}

export function formatCurrency(
  cents: bigint,
  language: 'pt-BR' | 'en',
  currency = 'BRL',
  hidden = false,
): string {
  if (hidden) return '••••';
  const negative = cents < 0n;
  const magnitude = negative ? -cents : cents;
  const locale = language === 'pt-BR' ? 'pt-BR' : 'en';
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const groupedWhole = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(magnitude / 100n);
  let placedInteger = false;
  return formatter
    .formatToParts(negative ? -1 : 1)
    .map((part) => {
      if (part.type === 'integer') {
        if (placedInteger) return '';
        placedInteger = true;
        return groupedWhole;
      }
      if (part.type === 'fraction') return (magnitude % 100n).toString().padStart(2, '0');
      return part.value;
    })
    .join('');
}

export function formatDate(value: Date | string, language: 'pt-BR' | 'en'): string {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00.000Z`)
      : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date.');
  return new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export function useI18n() {
  const { value } = usePreferences();
  const language = value.language;
  return {
    language,
    t: (key: TranslationKey) => translate(language, key),
    formatCurrency: (cents: bigint, currency = 'BRL', hidden = false) =>
      formatCurrency(cents, language, currency, hidden),
    formatDate: (value: Date | string) => formatDate(value, language),
  };
}
