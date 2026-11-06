import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personalReport, reportCsv } from '../apps/mobile/src/personal/reports.ts';
import type { FinancialCategory, FinancialTransaction } from '@fintrack/shared';

const categories: FinancialCategory[] = [
  { id: 'food', name: 'Mercado', kind: 'expense', essentialForReserve: true },
];
const rows: FinancialTransaction[] = [
  {
    id: 'a',
    kind: 'income',
    amountCents: '500000',
    date: '2026-10-03',
    status: 'posted',
    accountId: 'one',
    description: 'Salário',
  },
  {
    id: 'b',
    kind: 'expense',
    amountCents: '12345',
    date: '2026-10-04',
    status: 'posted',
    accountId: 'one',
    categoryId: 'food',
    description: 'Mercado; "família"',
  },
  {
    id: 'c',
    kind: 'expense',
    amountCents: '15000',
    date: '2026-11-04',
    status: 'planned',
    accountId: 'one',
    categoryId: 'food',
    description: 'Futuro',
  },
  {
    id: 'd',
    kind: 'transfer',
    amountCents: '10000',
    date: '2026-10-05',
    status: 'posted',
    accountId: 'one',
    transferAccountId: 'two',
    description: 'Transferência',
  },
];

test('reports use posted transactions, preserve exact cents and include zero months', () => {
  const report = personalReport(rows, categories, '2026-09', '2026-11', null);
  assert.equal(report.income, 500000n);
  assert.equal(report.expense, 12345n);
  assert.equal(report.months[0]?.net, 0n);
  assert.equal(report.months[1]?.net, 487655n);
  assert.equal(report.months[2]?.net, 0n);
  assert.deepEqual(report.byCategory, [{ id: 'food', name: 'Mercado', amount: 12345n }]);
  assert.equal(personalReport(rows, categories, '2026-10', '2026-10', 'food').income, 0n);
  assert.equal(personalReport(rows, categories, '2026-10', '2026-10', 'food').expense, 12345n);
  assert.throws(() => personalReport(rows, categories, '2026-11', '2026-10', null), RangeError);
});

test('CSV escapes descriptions and exports decimal comma without floating point', () => {
  const csv = reportCsv(rows.slice(0, 2), categories);
  assert.match(csv, /"Mercado; ""família""";"Mercado";"123,45"/);
  assert.match(csv, /"5000,00"/);
});

test('equal dates and equal category totals have deterministic tie breakers', () => {
  const options = ['a', 'b'].map((id) => ({ ...categories[0]!, id, name: 'Same' }));
  const entries = ['b', 'a'].map((id) => ({ ...rows[1]!, id, categoryId: id }));
  for (const input of [entries, [...entries].reverse()]) {
    const report = personalReport(input, options, '2026-10', '2026-10', null);
    assert.deepEqual(
      report.rows.map((item) => item.id),
      ['b', 'a'],
    );
    assert.deepEqual(
      report.byCategory.map((item) => item.id),
      ['a', 'b'],
    );
  }
});

test('personal CSV neutralizes formulas in descriptions and category names', () => {
  const unsafeCategories = [{ ...categories[0]!, name: '  =HYPERLINK("https://example.invalid")' }];
  const csv = reportCsv([{ ...rows[1]!, description: '\t+SUM(1,2)' }], unsafeCategories);
  assert.match(csv, /"'\t\+SUM\(1,2\)"/);
  assert.match(csv, /"' {2}=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
});
