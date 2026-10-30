import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CategoriesService } from '../apps/api/dist/categories/categories.service.js';

test('categories are owner-scoped and preserve the reserve-essential classification', async () => {
  const writes = [];
  const persisted = {
    id: 'category-1',
    name: 'Housing',
    kind: 'EXPENSE',
    essentialForReserve: true,
  };
  const db = {
    category: {
      async create(args) {
        writes.push(args);
        return persisted;
      },
      async findMany(args) {
        writes.push(args);
        return [persisted];
      },
    },
  };
  const categories = new CategoriesService({ db });
  const result = await categories.create('user-owner', {
    name: 'Housing',
    kind: 'expense',
    essentialForReserve: true,
  });
  assert.deepEqual(result, {
    id: 'category-1',
    name: 'Housing',
    kind: 'expense',
    essentialForReserve: true,
  });
  assert.equal(writes[0].data.userId, 'user-owner');
  assert.equal(writes[0].data.kind, 'EXPENSE');
  assert.deepEqual(await categories.list('user-owner'), [result]);
  assert.deepEqual(writes[1].where, { userId: 'user-owner', archivedAt: null });
});

test('category input validation prevents writes for unsupported fields and names', async () => {
  let writes = 0;
  const categories = new CategoriesService({
    db: { category: { create: async () => writes++ } },
  });
  await assert.rejects(
    categories.create('user-owner', {
      name: ' ',
      kind: 'expense',
      essentialForReserve: true,
      userId: 'attacker',
    }),
    { status: 400 },
  );
  assert.equal(writes, 0);
});
