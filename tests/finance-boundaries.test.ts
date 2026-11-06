import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateAccountBalance,
  type FinancialAccount,
  type FinancialTransaction,
} from '@fintrack/shared';
import { summarizePersonalFinance } from '../apps/mobile/src/personal/summary.ts';

test('large internal transfers preserve wealth across account order and do not become income or expense', () => {
  const amount = 9007199254740993n;
  const source: FinancialAccount = {
    id: 'source',
    name: 'Source',
    type: 'checking',
    openingDate: '2026-01-01',
    openingBalanceCents: amount.toString(),
    includeInPlan: true,
  };
  const destination: FinancialAccount = {
    ...source,
    id: 'destination',
    openingBalanceCents: '-101',
    archived: true,
  };
  const entry: FinancialTransaction = {
    id: 'transfer',
    accountId: source.id,
    transferAccountId: destination.id,
    kind: 'transfer',
    status: 'posted',
    description: 'Internal transfer',
    date: '2026-01-01',
    amountCents: amount.toString(),
  };
  for (const accounts of [
    [source, destination],
    [destination, source],
  ]) {
    const summary = summarizePersonalFinance(accounts, [], [entry], '2026-01-01');
    assert.equal(summary.balance, amount - 101n);
    assert.deepEqual(summary.current, { income: 0n, expense: 0n, net: 0n });
    assert.deepEqual(summary.categories, []);
  }
  assert.equal(calculateAccountBalance(source, [entry], entry.date), 0n);
  assert.equal(calculateAccountBalance(destination, [entry], entry.date), amount - 101n);
});

test('planned and future transfers affect neither side of the current balance', () => {
  const account: FinancialAccount = {
    id: 'one',
    name: 'One',
    type: 'cash',
    openingDate: '2026-01-01',
    openingBalanceCents: '-10',
    includeInPlan: true,
  };
  const entry: FinancialTransaction = {
    id: 'future',
    accountId: 'two',
    transferAccountId: 'one',
    kind: 'transfer',
    status: 'posted',
    description: 'Future',
    date: '2026-01-03',
    amountCents: '100',
  };
  assert.equal(
    calculateAccountBalance(
      account,
      [entry, { ...entry, id: 'planned', date: '2026-01-01', status: 'planned' }],
      '2026-01-02',
    ),
    -10n,
  );
  assert.equal(calculateAccountBalance(account, [entry], '2026-01-03'), 90n);
});
