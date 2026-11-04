import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CardsService } from '../apps/api/dist/cards/cards.service.js';

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
test('card registration rejects full numbers and scopes reads and archive updates', async () => {
  const rows = [];
  const db = {
    creditCard: {
      create: async ({ data }) => {
        const row = { id: '33333333-3333-4333-8333-333333333333', archivedAt: null, ...data };
        rows.push(row);
        return row;
      },
      findMany: async ({ where }) => rows.filter((row) => row.userId === where.userId),
      updateMany: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id && item.userId === where.userId);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      findFirstOrThrow: async ({ where }) =>
        rows.find((row) => row.id === where.id && row.userId === where.userId),
    },
  };
  const service = new CardsService({ db });
  const input = {
    name: 'Daily',
    institution: 'Bank',
    limitCents: '50000',
    closingDay: 10,
    dueDay: 20,
    color: '#C84A01',
  };
  await assert.rejects(service.create(owner, { ...input, number: '4111111111111111' }), {
    status: 400,
  });
  const card = await service.create(owner, input);
  assert.equal(card.limitCents, '50000');
  assert.equal((await service.list(stranger)).length, 0);
  await assert.rejects(service.update(stranger, card.id, { archived: true }), { status: 404 });
  assert.equal((await service.update(owner, card.id, { archived: true })).archived, true);
});
