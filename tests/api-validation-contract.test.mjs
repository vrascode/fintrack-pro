import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { TransactionsService } from '../apps/api/dist/transactions/transactions.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
test('invalid query and detail contracts fail before database access', async () => {
  const service = new TransactionsService({
    db: new Proxy(
      {},
      {
        get() {
          throw new Error('Unexpected database access');
        },
      },
    ),
  });
  for (const query of [
    null,
    [],
    { unknown: 'private' },
    { from: '2026-02-30' },
    { from: '2026-03-01', to: '2026-02-01' },
    { categoryId: ['one', 'two'] },
    { kind: 'INCOME' },
    { search: '   ' },
  ]) {
    await assert.rejects(
      () => service.list(userId, query),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.doesNotMatch(JSON.stringify(error.getResponse()), /Unexpected database/);
        return true;
      },
    );
  }
  for (const id of ['', '../accounts', 'not-a-uuid']) {
    await assert.rejects(() => service.detail(userId, id), BadRequestException);
  }
});

test('inclusive date and account filters retain ownership and exclude voided records', async () => {
  const accountId = '00000000-0000-4000-8000-000000000002';
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
  await service.list(userId, { accountId, from: '2024-02-29', to: '2024-02-29', limit: '1' });
  assert.equal(query.where.userId, userId);
  assert.equal(query.where.voidedAt, null);
  assert.deepEqual(query.where.OR, [{ accountId }, { transferAccountId: accountId }]);
  assert.equal(query.where.occurredOn.gte.toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(query.where.occurredOn.lte.toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(query.take, 1);
});
