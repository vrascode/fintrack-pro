import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountsService } from '../apps/api/dist/accounts/accounts.service.js';

test('account creation stores exact opening cents and lists only active accounts for its owner', async () => {
  const creates = [];
  const queries = [];
  const persisted = {
    id: 'account-1',
    name: 'Main account',
    type: 'CHECKING',
    openingBalanceCents: 100000n,
    openingBalanceOn: new Date('2026-10-01T00:00:00.000Z'),
    includeInPlanning: true,
  };
  const db = {
    account: {
      async create(args) {
        creates.push(args);
        return persisted;
      },
      async findMany(args) {
        queries.push(args);
        return [persisted];
      },
    },
  };
  const accounts = new AccountsService({ db });
  const created = await accounts.create('user-owner', {
    name: 'Main account',
    type: 'checking',
    openingBalanceCents: '100000',
    openingDate: '2026-10-01',
    includeInPlan: true,
  });
  assert.equal(created.openingBalanceCents, '100000');
  assert.equal(creates[0].data.userId, 'user-owner');
  assert.equal(creates[0].data.openingBalanceCents, 100000n);
  assert.equal(creates[0].data.openingBalanceOn.toISOString(), '2026-10-01T00:00:00.000Z');

  assert.deepEqual(await accounts.list('user-owner'), [created]);
  assert.deepEqual(queries[0].where, { userId: 'user-owner' });
});

test('invalid account input is rejected before any database write', async () => {
  let writes = 0;
  const accounts = new AccountsService({ db: { account: { create: async () => writes++ } } });
  await assert.rejects(accounts.create('user-owner', { name: '', openingBalanceCents: '1.2' }), {
    status: 400,
  });
  assert.equal(writes, 0);
});

test('account updates enforce ownership, preserve opening balances and keep archived history', async () => {
  const owner = '00000000-0000-4000-8000-000000000001';
  const id = '00000000-0000-4000-8000-000000000002';
  let update;
  const service = new AccountsService({
    db: {
      account: {
        updateMany: async (args) => {
          update = args;
          return { count: args.where.userId === owner ? 1 : 0 };
        },
        findMany: async () => [
          {
            id,
            name: 'Archived',
            type: 'CASH',
            openingBalanceCents: 10n,
            openingBalanceOn: new Date('2026-10-01'),
            includeInPlanning: true,
            archivedAt: new Date(),
          },
        ],
      },
    },
  });
  await service.update(owner, id, { name: 'Renamed', archived: true });
  assert.deepEqual(update.where, { id, userId: owner });
  assert.ok(update.data.archivedAt instanceof Date);
  assert.equal(update.data.openingBalanceCents, undefined);
  assert.equal((await service.list(owner))[0].archived, true);
  await assert.rejects(service.update('other', id, { archived: true }), { status: 404 });
  await assert.rejects(service.update(owner, id, { openingBalanceCents: '20' }), { status: 400 });
  await assert.rejects(service.update(owner, 'invalid', { name: 'Renamed' }), { status: 400 });
});
