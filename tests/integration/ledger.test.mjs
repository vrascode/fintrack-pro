// This suite requires real PostgreSQL and the generated Prisma client.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';
import { createDatabaseAdapter } from '../../apps/api/dist/database/adapter.js';
import { TransactionsService } from '../../apps/api/dist/transactions/transactions.service.js';
import { TransactionChangesService } from '../../apps/api/dist/transactions/transaction-changes.service.js';

const connectionString = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const { PrismaClient } = await import('../../apps/api/src/generated/prisma/client.ts');
const client = () =>
  new PrismaClient({
    adapter: createDatabaseAdapter(connectionString),
    log: [],
  });

test('transaction edits and removals preserve audit and isolate concurrent changes in PostgreSQL', async (t) => {
  const db = client();
  const userId = randomUUID();
  await db.$connect();
  t.after(async () => {
    try {
      await db.user.deleteMany({ where: { id: userId } });
    } finally {
      await db.$disconnect();
    }
  });
  await db.user.create({
    data: { id: userId, email: `changes-${userId}@example.test`, passwordHash: 'test-only' },
  });
  const account = await db.account.create({
    data: { userId, name: 'Changes test', type: 'CASH', openingBalanceOn: new Date('2026-01-01') },
  });
  const destination = await db.account.create({
    data: {
      userId,
      name: 'Destination',
      type: 'SAVINGS',
      openingBalanceOn: new Date('2026-01-01'),
    },
  });
  const service = new TransactionsService({ db });
  const changes = new TransactionChangesService({ db });
  const input = {
    kind: 'income',
    accountId: account.id,
    amountCents: '500000',
    date: '2026-01-10',
    description: 'Initial',
  };
  const key = randomUUID();
  const created = await service.create(userId, key, input);
  await assert.rejects(
    changes.edit(randomUUID(), created.id, { revision: 1, transaction: input }),
    { status: 404 },
  );
  const outcomes = await Promise.allSettled([
    changes.edit(userId, created.id, {
      revision: 1,
      transaction: { ...input, amountCents: '420000' },
    }),
    changes.edit(userId, created.id, {
      revision: 1,
      transaction: { ...input, kind: 'transfer', transferAccountId: destination.id },
    }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.status, 409);
  const current = await service.detail(userId, created.id);
  assert.equal(current.revision, 2);
  assert.equal(await db.transactionChange.count({ where: { transactionId: created.id } }), 1);
  await changes.void(userId, created.id, { revision: 2 });
  await changes.void(userId, created.id, { revision: 2 });
  assert.deepEqual(await service.list(userId, {}), []);
  assert.equal(await db.transaction.count({ where: { id: created.id } }), 1);
  assert.equal(await db.transactionChange.count({ where: { transactionId: created.id } }), 2);
  await assert.rejects(service.create(userId, key, input), { status: 409 });
  const peer = client();
  try {
    assert.ok((await peer.transaction.findUniqueOrThrow({ where: { id: created.id } })).voidedAt);
  } finally {
    await peer.$disconnect();
  }
});

test('ledger persists exact amounts and enforces owner and idempotency constraints', async (t) => {
  const db = client();
  const userIds = [randomUUID(), randomUUID()];
  const passwordHash = 'integration-only-not-a-credential';
  await db.$connect();
  t.after(async () => {
    try {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  const [owner, other] = await Promise.all(
    userIds.map((id, index) =>
      db.user.create({
        data: { id, email: `ledger-${index}-${id}@example.test`, passwordHash },
      }),
    ),
  );
  const [checking, savings, foreignAccount] = await Promise.all([
    db.account.create({ data: { userId: owner.id, name: 'Checking', type: 'CHECKING' } }),
    db.account.create({ data: { userId: owner.id, name: 'Savings', type: 'SAVINGS' } }),
    db.account.create({ data: { userId: other.id, name: 'Private', type: 'CASH' } }),
  ]);
  const category = await db.category.create({
    data: { userId: owner.id, name: 'Salary', kind: 'INCOME' },
  });
  const idempotencyKey = randomUUID();
  const income = await db.transaction.create({
    data: {
      userId: owner.id,
      accountId: checking.id,
      categoryId: category.id,
      kind: 'INCOME',
      amountCents: 9876543210123n,
      description: 'Payroll',
      occurredOn: new Date('2026-10-29T00:00:00.000Z'),
      idempotencyKey,
    },
  });

  const peer = client();
  try {
    await peer.$connect();
    assert.equal(
      (await peer.transaction.findUniqueOrThrow({ where: { id: income.id } })).amountCents,
      9876543210123n,
    );
    assert.equal(await peer.transaction.count({ where: { userId: other.id } }), 0);
  } finally {
    await peer.$disconnect();
  }

  await t.test('a transaction cannot reference another user’s account or category', async () => {
    await assert.rejects(
      db.transaction.create({
        data: {
          userId: owner.id,
          accountId: foreignAccount.id,
          kind: 'EXPENSE',
          amountCents: 1n,
          description: 'Unauthorized account',
          occurredOn: new Date('2026-10-29T00:00:00.000Z'),
          idempotencyKey: randomUUID(),
        },
      }),
    );
    await assert.rejects(
      db.transaction.create({
        data: {
          userId: owner.id,
          accountId: checking.id,
          categoryId: (
            await db.category.create({
              data: { userId: other.id, name: 'Private', kind: 'EXPENSE' },
            })
          ).id,
          kind: 'EXPENSE',
          amountCents: 1n,
          description: 'Unauthorized category',
          occurredOn: new Date('2026-10-29T00:00:00.000Z'),
          idempotencyKey: randomUUID(),
        },
      }),
    );
  });

  await t.test('duplicate idempotency keys and invalid transfer shapes are rejected', async () => {
    await assert.rejects(
      db.transaction.create({
        data: {
          userId: owner.id,
          accountId: checking.id,
          kind: 'INCOME',
          amountCents: 100n,
          description: 'Duplicate',
          occurredOn: new Date('2026-10-29T00:00:00.000Z'),
          idempotencyKey,
        },
      }),
      { code: 'P2002' },
    );
    await assert.rejects(
      db.transaction.create({
        data: {
          userId: owner.id,
          accountId: checking.id,
          transferAccountId: savings.id,
          kind: 'TRANSFER',
          amountCents: 0n,
          description: 'Invalid transfer',
          occurredOn: new Date('2026-10-29T00:00:00.000Z'),
          idempotencyKey: randomUUID(),
        },
      }),
    );
  });
});
