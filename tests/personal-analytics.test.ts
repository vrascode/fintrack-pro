import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FinancialAccount, FinancialTransaction } from '@fintrack/shared';
import {
  dashboardSeries,
  percentChange,
  periodEnd,
} from '../apps/mobile/src/personal/analytics.ts';

const account: FinancialAccount = {
  id: 'account',
  name: 'Current account',
  type: 'checking',
  openingDate: '2026-01-01',
  openingBalanceCents: '10000',
  includeInPlan: true,
};
const transaction = (
  id: string,
  date: string,
  kind: 'income' | 'expense',
  amountCents: string,
): FinancialTransaction => ({
  id,
  date,
  kind,
  amountCents,
  accountId: account.id,
  description: id,
  status: 'posted',
});

test('dashboard periods stop at the selected month end and never include later postings', () => {
  assert.equal(periodEnd('2026-02', '2026-04-10'), '2026-02-28');
  assert.equal(periodEnd('2026-04', '2026-04-10'), '2026-04-10');
  const series = dashboardSeries(
    [account],
    [],
    [
      transaction('jan', '2026-01-10', 'income', '5000'),
      transaction('feb', '2026-02-10', 'expense', '2000'),
      transaction('future', '2026-03-01', 'expense', '9000'),
    ],
    '2026-02',
    '2026-04-10',
  );
  assert.equal(series.length, 6);
  assert.deepEqual(
    series.slice(-2).map((row) => [row.month, row.net, row.balance]),
    [
      ['2026-01', 5000n, 15000n],
      ['2026-02', -2000n, 13000n],
    ],
  );
});

test('percentage comparison leaves a missing baseline empty and handles a negative result', () => {
  assert.equal(percentChange(100n, 0n), null);
  assert.equal(percentChange(-500n, 1000n), '−150,00%');
  assert.equal(percentChange(1250n, 1000n), '+25,00%');
});
