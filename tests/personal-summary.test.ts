import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FinancialAccount, FinancialTransaction } from '@fintrack/shared';
import { summarizePersonalFinance } from '../apps/mobile/src/personal/summary.ts';

const account: FinancialAccount = {
  id: 'checking',
  name: 'Main',
  type: 'checking',
  openingDate: '2025-01-01',
  openingBalanceCents: '100000',
  includeInPlan: true,
};
const entry = (
  id: string,
  kind: FinancialTransaction['kind'],
  amountCents: string,
  date = '2026-01-10',
): FinancialTransaction => ({
  id,
  kind,
  amountCents,
  date,
  accountId: account.id,
  description: id,
  status: 'posted',
});

test('personal overview derives exact monthly results and category spending from posted records', () => {
  const result = summarizePersonalFinance(
    [account],
    [],
    [
      entry('salary', 'income', '500000'),
      entry('expenses', 'expense', '420000'),
      entry('previous', 'income', '20000', '2025-12-31'),
      { ...entry('planned', 'expense', '999999'), status: 'planned' },
      entry('future', 'expense', '999999', '2026-01-31'),
    ],
    '2026-01-15',
  );
  assert.deepEqual(result.current, { income: 500000n, expense: 420000n, net: 80000n });
  assert.equal(result.previousMonth, '2025-12');
  assert.equal(result.previous.net, 20000n);
  assert.equal(result.balance, 200000n);
  assert.deepEqual(result.categories, [{ id: '', name: undefined, amount: 420000n }]);
});

test('transfers conserve wealth, archived accounts retain balances and future accounts do not crash the overview', () => {
  const destination = { ...account, id: 'savings', archived: true };
  const result = summarizePersonalFinance(
    [account, destination, { ...account, id: 'future', openingDate: '2027-01-01' }],
    [],
    [{ ...entry('transfer', 'transfer', '50000'), transferAccountId: destination.id }],
    '2026-01-15',
  );
  assert.equal(result.balance, 200000n);
  assert.equal(result.current.net, 0n);
  assert.equal(result.futureAccounts, 1);
  assert.deepEqual(result.categories, []);
});
