// This suite requires real PostgreSQL and the generated Prisma client.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../../scripts/database.mjs';

const connectionString = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaPg } = requireApi('@prisma/adapter-pg');
const { PrismaClient } = await import('../../apps/api/src/generated/prisma/client.ts');
const client = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
    log: [],
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
