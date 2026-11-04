import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';
import { createDatabaseAdapter } from '../../apps/api/dist/database/adapter.js';
import { CardLedgerService } from '../../apps/api/dist/cards/card-ledger.service.js';

const url = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const { PrismaClient } = await import('../../apps/api/src/generated/prisma/client.ts');
const connect = () => new PrismaClient({ adapter: createDatabaseAdapter(url) });

test('card purchases, installments, invoices and payments persist with owner scope', async (t) => {
  const db = connect();
  const userId = randomUUID();
  const otherId = randomUUID();
  await db.$connect();
  t.after(async () => {
    try {
      await db.cardPayment.deleteMany({ where: { userId } });
      await db.transaction.deleteMany({ where: { userId } });
      await db.cardPurchase.deleteMany({ where: { userId } });
      await db.creditCard.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    } finally {
      await db.$disconnect();
    }
  });
  for (const id of [userId, otherId])
    await db.user.create({
      data: { id, email: `card-${id}@example.test`, passwordHash: 'test-only' },
    });
  const account = await db.account.create({
    data: {
      userId,
      name: 'Pay card',
      type: 'CASH',
      openingBalanceOn: new Date('2026-01-01'),
      openingBalanceCents: 20000n,
    },
  });
  const card = await db.creditCard.create({
    data: {
      userId,
      name: 'Test',
      institution: 'Bank',
      limitCents: 15000n,
      closingDay: 10,
      dueDay: 20,
      color: '#C84A01',
    },
  });
  const ledger = new CardLedgerService({ db });
  const input = {
    description: 'Purchase',
    amountCents: '10001',
    purchasedOn: '2026-10-11',
    installments: 3,
  };
  const purchase = await ledger.purchase(userId, card.id, 'buy-one', input);
  assert.deepEqual(await ledger.purchase(userId, card.id, 'buy-one', input), purchase);
  await assert.rejects(ledger.overview(otherId, card.id), { status: 404 });
  const view = await ledger.overview(userId, card.id);
  assert.equal(view.usedCents, '10001');
  assert.equal(view.availableCents, '4999');
  assert.deepEqual(
    view.invoices.map((item) => item.totalCents),
    ['3333', '3334', '3334'],
  );
  await assert.rejects(
    ledger.purchase(userId, card.id, 'over-limit', { ...input, amountCents: '6000' }),
    { status: 409 },
  );
  const first = await ledger.pay(userId, card.id, 'pay-one', {
    invoiceMonth: '2026-11',
    accountId: account.id,
    amountCents: '2000',
  });
  assert.deepEqual(
    await ledger.pay(userId, card.id, 'pay-one', {
      invoiceMonth: '2026-11',
      accountId: account.id,
      amountCents: '2000',
    }),
    first,
  );
  await assert.rejects(
    ledger.pay(userId, card.id, 'pay-one', {
      invoiceMonth: '2026-11',
      accountId: account.id,
      amountCents: '1999',
    }),
    { status: 409 },
  );
  const persisted = connect();
  try {
    await persisted.$connect();
    assert.equal(
      (await new CardLedgerService({ db: persisted }).overview(userId, card.id)).usedCents,
      '8001',
    );
  } finally {
    await persisted.$disconnect();
  }
  const transactions = await db.transaction.findMany({ where: { userId } });
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].kind, 'EXPENSE');
  assert.equal(account.openingBalanceCents - transactions[0].amountCents, 18000n);
  await assert.rejects(ledger.cancelPurchase(userId, card.id, purchase.id), { status: 409 });
});
