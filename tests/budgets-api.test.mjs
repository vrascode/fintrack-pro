import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BudgetsService } from '../apps/api/dist/budgets/budgets.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';
const budgetId = '00000000-0000-4000-8000-000000000004';
const row = {
  id: budgetId,
  userId,
  categoryId,
  category: { name: 'Mercado' },
  month: new Date('2026-10-01T00:00:00.000Z'),
  limitCents: 80000n,
};

test('monthly budget reads exact posted expense cents in its month and owner scope', async () => {
  let budgetQuery;
  let spentQuery;
  const service = new BudgetsService({
    db: {
      monthlyBudget: {
        findMany: async (query) => {
          budgetQuery = query;
          return [row];
        },
      },
      transaction: {
        groupBy: async (query) => {
          spentQuery = query;
          return [{ categoryId, _sum: { amountCents: 60000n } }];
        },
      },
    },
  });
  assert.deepEqual(await service.list(userId, { month: '2026-10' }), [
    {
      id: budgetId,
      categoryId,
      categoryName: 'Mercado',
      month: '2026-10',
      limitCents: '80000',
      spentCents: '60000',
    },
  ]);
  assert.equal(budgetQuery.where.userId, userId);
  assert.equal(spentQuery.where.userId, userId);
  assert.equal(spentQuery.where.kind, 'EXPENSE');
  assert.equal(spentQuery.where.voidedAt, null);
  assert.deepEqual(spentQuery.where.categoryId.in, [categoryId]);
  assert.equal(spentQuery.where.occurredOn.gte.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(spentQuery.where.occurredOn.lt.toISOString(), '2026-11-01T00:00:00.000Z');
});

test('budgets reject invalid input and categories outside the active expense scope', async () => {
  let writes = 0;
  const service = new BudgetsService({
    db: {
      category: { findFirst: async () => null },
      monthlyBudget: {
        create: async () => {
          writes++;
        },
      },
    },
  });
  await assert.rejects(
    service.create(userId, { categoryId, month: '2026-13', limitCents: '80000' }),
    { status: 400 },
  );
  await assert.rejects(service.create(userId, { categoryId, month: '2026-10', limitCents: '0' }), {
    status: 400,
  });
  await assert.rejects(
    service.create(userId, { categoryId, month: '2026-10', limitCents: '80000' }),
    { status: 400 },
  );
  assert.equal(writes, 0);
});

test('budget create preserves cents and rejects duplicate category-month records', async () => {
  let created;
  const service = new BudgetsService({
    db: {
      category: { findFirst: async () => ({ id: categoryId }) },
      monthlyBudget: {
        create: async (args) => {
          created = args;
          return { id: budgetId };
        },
        findMany: async () => [row],
      },
      transaction: { groupBy: async () => [] },
    },
  });
  const saved = await service.create(userId, { categoryId, month: '2026-10', limitCents: '80000' });
  assert.equal(saved.spentCents, '0');
  assert.equal(created.data.userId, userId);
  assert.equal(created.data.limitCents, 80000n);
  assert.equal(created.data.month.toISOString(), '2026-10-01T00:00:00.000Z');
  const duplicate = new BudgetsService({
    db: {
      category: { findFirst: async () => ({ id: categoryId }) },
      monthlyBudget: {
        create: async () => {
          throw { code: 'P2002' };
        },
      },
    },
  });
  await assert.rejects(
    duplicate.create(userId, { categoryId, month: '2026-10', limitCents: '80000' }),
    { status: 409 },
  );
});

test('budget edits and deletion require ownership', async () => {
  let updated;
  let removed;
  const service = new BudgetsService({
    db: {
      monthlyBudget: {
        findFirst: async (args) => (args.where.userId === userId ? { month: row.month } : null),
        updateMany: async (args) => {
          updated = args;
          return { count: 1 };
        },
        deleteMany: async (args) => {
          removed = args;
          return { count: args.where.userId === userId ? 1 : 0 };
        },
        findMany: async () => [{ ...row, limitCents: 90000n }],
      },
      transaction: { groupBy: async () => [] },
    },
  });
  assert.equal(
    (await service.update(userId, budgetId, { limitCents: '90000' })).limitCents,
    '90000',
  );
  assert.deepEqual(updated.where, { id: budgetId, userId });
  await assert.rejects(service.update(otherId, budgetId, { limitCents: '90000' }), { status: 404 });
  await assert.rejects(service.update(userId, budgetId, { limitCents: '-1' }), { status: 400 });
  assert.deepEqual(await service.remove(userId, budgetId), { success: true });
  assert.deepEqual(removed.where, { id: budgetId, userId });
  await assert.rejects(service.remove(otherId, budgetId), { status: 404 });
});
