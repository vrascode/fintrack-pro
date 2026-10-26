import { z } from 'zod';

export function daysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    throw new RangeError('Invalid year/month');
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
    try {
      return day >= 1 && day <= daysInMonth(year, month);
    } catch {
      return false;
    }
  }, 'Invalid calendar date');

export function addMonths(date: string, months: number): string {
  calendarDateSchema.parse(date);
  if (!Number.isSafeInteger(months)) throw new RangeError('Months must be an integer');
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const index = year * 12 + month - 1 + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (((index % 12) + 12) % 12) + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

export function dateInTimeZone(instant: Date, timeZone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return calendarDateSchema.parse(`${part('year')}-${part('month')}-${part('day')}`);
}
