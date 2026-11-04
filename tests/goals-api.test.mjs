import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GoalsService } from '../apps/api/dist/goals/goals.service.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const goalId = '00000000-0000-4000-8000-000000000003';
const key = 'goal-request-1';
const input = { amountCents: '12345', contributedOn: '2026-11-03', note: null };
const row = {
  id: goalId,
  name: 'Reserva',
  targetCents: 500000n,
  targetOn: null,
  status: 'ACTIVE',
  contributions: [],
};

test('goal contributions require an active owned goal and a valid idempotency key', async () => {
  let writes = 0;
  const service = new GoalsService({
    db: {
      goalContribution: { findUnique: async () => null, create: async () => writes++ },
      savingsGoal: { findFirst: async () => null },
    },
  });
  await assert.rejects(service.contribute(userId, goalId, undefined, input), { status: 400 });
  await assert.rejects(service.contribute(userId, goalId, key, { ...input, amountCents: '0' }), {
    status: 400,
  });
  await assert.rejects(service.contribute(otherId, goalId, key, input), { status: 404 });
  assert.equal(writes, 0);
});

test('repeated goal contribution does not write twice and a changed payload conflicts', async () => {
  let writes = 0;
  const previous = {
    goalId,
    amountCents: 12345n,
    note: null,
    contributedOn: new Date('2026-11-03'),
  };
  const service = new GoalsService({
    db: {
      goalContribution: { findUnique: async () => previous, create: async () => writes++ },
      savingsGoal: { findMany: async () => [row] },
    },
  });
  assert.equal((await service.contribute(userId, goalId, key, input)).contributedCents, '0');
  assert.equal(writes, 0);
  await assert.rejects(
    service.contribute(userId, goalId, key, { ...input, amountCents: '12346' }),
    { status: 409 },
  );
});

test('goal updates and deletion stay scoped to the authenticated user', async () => {
  const updates = [];
  const deletions = [];
  const service = new GoalsService({
    db: {
      savingsGoal: {
        updateMany: async (query) => {
          updates.push(query);
          return { count: query.where.userId === userId ? 1 : 0 };
        },
        deleteMany: async (query) => {
          deletions.push(query);
          return { count: query.where.userId === userId ? 1 : 0 };
        },
        findMany: async () => [row],
      },
    },
  });
  assert.equal((await service.update(userId, goalId, { targetCents: '600000' })).id, goalId);
  assert.deepEqual(updates[0].where, { id: goalId, userId });
  await assert.rejects(service.update(otherId, goalId, { targetCents: '600000' }), { status: 404 });
  assert.deepEqual(await service.remove(userId, goalId), { success: true });
  assert.deepEqual(deletions[0].where, { id: goalId, userId });
  await assert.rejects(service.remove(otherId, goalId), { status: 404 });
});
