import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installmentAmounts, invoiceDueOn, invoiceMonthFor } from '@fintrack/shared';

test('card installments preserve every cent and cycle months across closing dates', () => {
  assert.deepEqual(installmentAmounts(10001n, 3), [3334n, 3334n, 3333n]);
  assert.equal(
    installmentAmounts(10001n, 3).reduce((sum, item) => sum + item, 0n),
    10001n,
  );
  assert.equal(invoiceMonthFor('2026-12-10', 10), '2026-12');
  assert.equal(invoiceMonthFor('2026-12-11', 10), '2027-01');
  assert.equal(invoiceDueOn('2027-01', 10, 5), '2027-02-05');
  assert.equal(invoiceDueOn('2027-01', 10, 20), '2027-01-20');
  assert.throws(() => installmentAmounts(2n, 3), RangeError);
});
