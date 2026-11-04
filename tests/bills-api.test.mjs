import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BillsService } from '../apps/api/dist/bills/bills.service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const billId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const bill = {
  id: billId,
  userId,
  accountId,
  categoryId: null,
  kind: 'EXPENSE',
  description: 'Rent',
  amountCents: 10000n,
  firstDueOn: new Date('2026-01-31'),
  frequency: 'MONTHLY',
  canceledAt: null,
  payments: [],
};

test('partial and final bill payments write exactly one ledger transaction and reject overpayment', async () => {
  const payments = [];
  const transactions = [];
  const db = {
    $queryRaw: async () => [{ id: billId }],
    $transaction: async (action) => action(db),
    bill: {
      findFirst: async ({ where }) => (where.userId === userId ? { ...bill, payments } : null),
      findUniqueOrThrow: async () => bill,
    },
    account: { findFirst: async () => ({ openingBalanceOn: new Date('2026-01-01') }) },
    billPayment: {
      findUnique: async ({ where }) =>
        payments.find(
          (item) => item.idempotencyKey === where.userId_idempotencyKey.idempotencyKey,
        ) ?? null,
      create: async ({ data }) => {
        const item = { id: `${payments.length + 1}`, ...data };
        payments.push(item);
        return item;
      },
    },
    transaction: {
      create: async ({ data }) => {
        const item = { id: `${transactions.length + 1}`, ...data };
        transactions.push(item);
        return item;
      },
    },
  };
  const service = new BillsService({ db });
  const first = await service.pay(userId, billId, 'rent-first', {
    occurrenceIndex: 0,
    amountCents: '4000',
  });
  assert.deepEqual(
    await service.pay(userId, billId, 'rent-first', { occurrenceIndex: 0, amountCents: '4000' }),
    first,
  );
  await assert.rejects(
    service.pay(userId, billId, 'rent-too-much', { occurrenceIndex: 0, amountCents: '7000' }),
    { status: 409 },
  );
  await service.pay(userId, billId, 'rent-final', { occurrenceIndex: 0, amountCents: '6000' });
  assert.equal(transactions.length, 2);
  assert.equal(payments.length, 2);
  assert.equal(
    transactions.reduce((sum, item) => sum + item.amountCents, 0n),
    10000n,
  );
  assert.equal(transactions[0].kind, 'EXPENSE');
});
