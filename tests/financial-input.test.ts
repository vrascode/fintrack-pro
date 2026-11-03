import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  financialTransactionInputSchema,
  financialDatasetSchema,
  createDemoDataset,
} from '@fintrack/shared';

test('malformed cents produce validation errors rather than uncaught BigInt exceptions', () => {
  for (const amount of ['1.25', 'abc', '', '0x10', '9223372036854775808']) {
    const result = financialTransactionInputSchema.safeParse({
      kind: 'income',
      accountId: '00000000-0000-4000-8000-000000000001',
      date: '2026-01-01',
      description: 'Invalid amount',
      amountCents: amount,
    });
    assert.equal(result.success, false);
    const demo = createDemoDataset();
    demo.monthlyBudget[0]!.amountCents = amount;
    assert.equal(financialDatasetSchema.safeParse(demo).success, false);
  }
});
