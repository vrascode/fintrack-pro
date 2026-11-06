import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FinancialTransaction } from '@fintrack/shared';
import { filterHistory } from '../apps/mobile/src/personal/history.ts';

test('history combines filters, includes incoming transfers and sorts without modifying records', () => {
  const rows: FinancialTransaction[] = [
    {
      id: 'a',
      kind: 'income',
      accountId: 'main',
      categoryId: 'salary',
      date: '2026-01-01',
      description: 'Salary',
      amountCents: '500000',
      status: 'posted',
    },
    {
      id: 'b',
      kind: 'transfer',
      accountId: 'main',
      transferAccountId: 'savings',
      date: '2026-01-02',
      description: 'Reserve transfer',
      amountCents: '80000',
      status: 'posted',
    },
    {
      id: 'c',
      kind: 'expense',
      accountId: 'main',
      categoryId: 'home',
      date: '2026-01-03',
      description: 'Rent',
      amountCents: '420000',
      status: 'posted',
    },
  ];
  const filters = {
    search: '',
    from: '',
    to: '',
    accountId: '',
    categoryId: '',
    kind: '',
    ascending: false,
  };
  assert.deepEqual(
    filterHistory(rows, { ...filters, accountId: 'savings' }).map((row) => row.id),
    ['b'],
  );
  assert.deepEqual(
    filterHistory(rows, {
      ...filters,
      kind: 'expense',
      categoryId: 'home',
      search: ' RENT ',
      from: '2026-01-03',
      to: '2026-01-03',
    }).map((row) => row.id),
    ['c'],
  );
  assert.deepEqual(
    filterHistory(rows, filters).map((row) => row.id),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    filterHistory(rows, { ...filters, ascending: true }).map((row) => row.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'c'],
  );
  for (const period of [
    { from: '2026-02-30', to: '' },
    { from: '', to: 'invalid' },
    { from: '2026-02-01', to: '2026-01-01' },
  ])
    assert.deepEqual(filterHistory(rows, { ...filters, ...period }), []);
});
