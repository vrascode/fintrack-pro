import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billDueOn, billInputSchema } from '@fintrack/shared';

test('monthly dues clamp short months without drifting later occurrences', () => {
  assert.equal(billDueOn('2028-01-31', 'monthly', 1), '2028-02-29');
  assert.equal(billDueOn('2028-01-31', 'monthly', 2), '2028-03-31');
  assert.equal(billDueOn('2027-01-31', 'monthly', 1), '2027-02-28');
  assert.equal(billDueOn('2027-01-30', 'monthly', 2), '2027-03-30');
});

test('weekly dues cross months and one-time bills reject second occurrence', () => {
  assert.equal(billDueOn('2026-11-28', 'weekly', 1), '2026-12-05');
  assert.throws(() => billDueOn('2026-11-28', 'once', 1), RangeError);
  assert.equal(
    billInputSchema.safeParse({
      description: 'Rent',
      kind: 'expense',
      amountCents: '0',
      accountId: '99999999-9999-4999-8999-999999999999',
      firstDueOn: '2026-02-30',
      frequency: 'monthly',
    }).success,
    false,
  );
});
