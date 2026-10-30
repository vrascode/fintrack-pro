import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TransactionsService } from '../apps/api/dist/transactions/transactions.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';
const expense = {
  kind: 'expense',
  amountCents: '1250',
  date: '2026-10-15',
  accountId,
  categoryId,
  description: 'Lunch',
};

test('transaction history accepts bounded pagination and stable ordering instead of silently truncating balances', async () => {
  let query;
  const service = new TransactionsService({
    db: {
      transaction: {
        findMany: async (input) => {
          query = input;
          return [];
        },
      },
    },
  });
  await service.list(userId, { limit: '100', offset: '100' });
  assert.equal(query.where.userId, userId);
  assert.equal(query.take, 100);
  assert.equal(query.skip, 100);
  assert.deepEqual(query.orderBy, [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  await assert.rejects(() => service.list(userId, { offset: '-1' }), /Bad Request/);
  await assert.rejects(() => service.list(userId, { offset: '1000001' }), /Bad Request/);
});

test('transaction writes are owner-scoped, exact-cent, and idempotent', async () => {
  const records = new Map();
  let creates = 0;
  const row = {
    id: '00000000-0000-4000-8000-000000000004',
    kind: 'EXPENSE',
    amountCents: 1250n,
    occurredOn: new Date('2026-10-15T00:00:00.000Z'),
    accountId,
    transferAccountId: null,
    categoryId,
    description: 'Lunch',
  };
  const db = {
    transaction: {
      async findUnique({ where }) {
        return (
          records.get(
            `${where.userId_idempotencyKey.userId}:${where.userId_idempotencyKey.idempotencyKey}`,
          ) ?? null
        );
      },
      async create({ data }) {
        creates++;
        assert.equal(data.userId, userId);
        assert.equal(data.amountCents, 1250n);
        records.set(`${data.userId}:${data.idempotencyKey}`, row);
        return row;
      },
      async findMany(args) {
        assert.equal(args.where.userId, userId);
        return [row];
      },
    },
    account: { findMany: async ({ where }) => [{ id: where.id.in[0] }] },
    category: { findFirst: async ({ where }) => ({ id: where.id, kind: where.kind }) },
  };
  const service = new TransactionsService({ db });
  const created = await service.create(userId, 'request-123', expense);
  const repeated = await service.create(userId, 'request-123', expense);
  assert.deepEqual(repeated, created);
  assert.equal(creates, 1);
  assert.equal(created.amountCents, '1250');
  assert.equal(created.status, 'posted');
  assert.deepEqual(
    await service.list(userId, { kind: 'expense', from: '2026-10-01', limit: '20' }),
    [created],
  );
});

test('reusing an idempotency key with different financial data conflicts', async () => {
  const existing = {
    id: '00000000-0000-4000-8000-000000000004',
    kind: 'EXPENSE',
    amountCents: 1250n,
    occurredOn: new Date('2026-10-15T00:00:00.000Z'),
    accountId,
    transferAccountId: null,
    categoryId,
    description: 'Lunch',
  };
  const service = new TransactionsService({
    db: {
      transaction: { findUnique: async () => existing },
    },
  });
  await assert.rejects(service.create(userId, 'request-123', { ...expense, amountCents: '1300' }), {
    status: 409,
  });
});

test('transaction validation blocks invalid transfers and queries before database work', async () => {
  let writes = 0;
  const service = new TransactionsService({
    db: { transaction: { findMany: async () => writes++ } },
  });
  await assert.rejects(service.create(userId, 'request-123', { ...expense, kind: 'transfer' }), {
    status: 400,
  });
  await assert.rejects(
    service.create(userId, 'request-future', { ...expense, date: '2099-01-01' }),
    { status: 400 },
  );
  await assert.rejects(service.list(userId, { limit: '101' }), { status: 400 });
  assert.equal(writes, 0);
});
