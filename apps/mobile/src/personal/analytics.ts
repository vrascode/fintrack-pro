import {
  addMonths,
  daysInMonth,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialTransaction,
} from '@fintrack/shared';
import { summarizePersonalFinance } from './summary';

export function periodEnd(month: string, today: string): string {
  const [year, number] = month.split('-').map(Number);
  const end = `${month}-${String(daysInMonth(year!, number!)).padStart(2, '0')}`;
  return end < today ? end : today;
}

export function dashboardSeries(
  accounts: FinancialAccount[],
  categories: FinancialCategory[],
  transactions: FinancialTransaction[],
  selectedMonth: string,
  today: string,
) {
  return Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(`${selectedMonth}-01`, index - 5).slice(0, 7);
    const asOf = periodEnd(month, today);
    const summary = summarizePersonalFinance(accounts, categories, transactions, asOf);
    return { month, ...summary.current, balance: summary.balance };
  });
}

export function percentChange(current: bigint, previous: bigint): string | null {
  if (previous === 0n) return null;
  const basisPoints = ((current - previous) * 10000n) / (previous < 0n ? -previous : previous);
  const absolute = basisPoints < 0n ? -basisPoints : basisPoints;
  return `${basisPoints > 0n ? '+' : basisPoints < 0n ? '−' : ''}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')}%`;
}
