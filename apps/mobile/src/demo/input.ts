import { parseDecimal } from '@fintrack/shared';

/** Parse a user-entered localized decimal without converting money through Number. */
export function parseLocalizedCents(value: string, language: 'pt-BR' | 'en'): bigint {
  let normalized = value.trim().replace(/\s/g, '');
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const groupSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = normalized.replaceAll(groupSeparator, '').replace(decimalSeparator, '.');
  } else if (comma >= 0) {
    const trailing = normalized.length - comma - 1;
    normalized =
      trailing === 3 && language === 'en'
        ? normalized.replaceAll(',', '')
        : normalized.replace(',', '.');
  } else if (dot >= 0) {
    const trailing = normalized.length - dot - 1;
    normalized =
      trailing === 3 && language === 'pt-BR' ? normalized.replaceAll('.', '') : normalized;
  }
  const cents = parseDecimal(normalized);
  if (cents <= 0n) throw new RangeError('Amount must be positive.');
  return cents;
}
