import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';
import { createDatabaseAdapter } from '../../apps/api/dist/database/adapter.js';
import { BillsService } from '../../apps/api/dist/bills/bills.service.js';
import { TransactionChangesService } from '../../apps/api/dist/transactions/transaction-changes.service.js';

const url = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const { PrismaClient } = await import('../../apps/api/src/generated/prisma/client.ts');
const connect = () => new PrismaClient({ adapter: createDatabaseAdapter(url) });

test('bills persist, conserve exact cents, isolate owners and serialize concurrent payments', async (t) => {
  const db = connect();
  const userId = randomUUID();
  const otherId = randomUUID();
  await db.$connect();
  t.after(async () => {
    try {
      await db.billPayment.deleteMany({ where: { userId } });
      await db.transaction.deleteMany({ where: { userId } });
      await db.bill.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    } finally {
      await db.$disconnect();
    }
  });
  for (const id of [userId, otherId])
    await db.user.create({
      data: { id, email: `bill-${id}@example.test`, passwordHash: 'test-only' },
    });
  const account = await db.account.create({
    data: {
      userId,
      name: 'Bill test',
      type: 'CASH',
      openingBalanceOn: new Date('2026-01-01'),
      openingBalanceCents: 20000n,
    },
  });
  const service = new BillsService({ db });
  const bill = await service.create(userId, {
    description: 'Rent',
    kind: 'expense',
    amountCents: '10000',
    accountId: account.id,
    firstDueOn: '2026-01-31',
    frequency: 'monthly',
  });
  assert.equal((await service.list(otherId)).length, 0);
  await assert.rejects(
    service.pay(otherId, bill.id, 'foreign-key', { occurrenceIndex: 0, amountCents: '1' }),
    { status: 404 },
  );
  await service.update(userId, bill.id, {
    description: 'Rent edited',
    kind: 'expense',
    amountCents: '10000',
    accountId: account.id,
    firstDueOn: '2026-01-31',
    frequency: 'monthly',
  });
  const first = await service.pay(userId, bill.id, 'first-part', {
    occurrenceIndex: 0,
    amountCents: '4000',
  });
  assert.deepEqual(
    await service.pay(userId, bill.id, 'first-part', { occurrenceIndex: 0, amountCents: '4000' }),
    first,
  );
  await assert.rejects(
    service.pay(userId, bill.id, 'first-part', { occurrenceIndex: 1, amountCents: '4000' }),
    { status: 409 },
  );
  const attempts = await Promise.allSettled([
    service.pay(userId, bill.id, 'parallel-a', { occurrenceIndex: 0, amountCents: '6000' }),
    service.pay(userId, bill.id, 'parallel-b', { occurrenceIndex: 0, amountCents: '6000' }),
  ]);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  const payments = await db.billPayment.findMany({ where: { userId, billId: bill.id } });
  assert.equal(payments.length, 2);
  assert.equal(
    payments.reduce((sum, item) => sum + item.amountCents, 0n),
    10000n,
  );
  const ledger = await db.transaction.aggregate({
    where: { userId, accountId: account.id, voidedAt: null },
    _sum: { amountCents: true },
  });
  assert.equal(account.openingBalanceCents - (ledger._sum.amountCents ?? 0n), 10000n);
  const changes = new TransactionChangesService({ db });
  await assert.rejects(changes.void(userId, first.transactionId, { revision: 1 }), { status: 409 });
  const fresh = connect();
  try {
    await fresh.$connect();
    assert.equal((await new BillsService({ db: fresh }).list(userId))[0].payments.length, 2);
  } finally {
    await fresh.$disconnect();
  }
  await service.cancel(userId, bill.id);
  await assert.rejects(
    service.pay(userId, bill.id, 'after-cancel', { occurrenceIndex: 1, amountCents: '1' }),
    { status: 409 },
  );
});
