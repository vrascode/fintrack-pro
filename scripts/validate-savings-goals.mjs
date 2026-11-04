import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { createDatabaseAdapter } from '../apps/api/dist/database/adapter.js';
import { GoalsService } from '../apps/api/dist/goals/goals.service.js';

loadEnvFile('.env');
const target = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/fintrack')
  throw new Error('Goal validation accepts only the local fintrack database.');
const { PrismaClient } = await import('../apps/api/src/generated/prisma/client.ts');
const db = new PrismaClient({ adapter: createDatabaseAdapter(target.href) });
const rollback = new Error('Validated; roll back synthetic records.');

try {
  await db.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: { email: `goal-${randomUUID()}@example.test`, passwordHash: 'validation-only' },
    });
    const other = await tx.user.create({
      data: { email: `goal-${randomUUID()}@example.test`, passwordHash: 'validation-only' },
    });
    const service = new GoalsService({ db: tx });
    const goal = await service.create(owner.id, {
      name: 'Reserva',
      targetCents: '500000',
      targetOn: null,
    });
    assert.equal(goal.contributedCents, '0');
    assert.deepEqual(await service.list(other.id), []);
    await assert.rejects(service.update(other.id, goal.id, { targetCents: '600000' }), {
      status: 404,
    });
    await assert.rejects(
      service.contribute(other.id, goal.id, randomUUID(), {
        amountCents: '10000',
        contributedOn: '2026-11-03',
        note: null,
      }),
      { status: 404 },
    );
    const key = randomUUID();
    const funded = await service.contribute(owner.id, goal.id, key, {
      amountCents: '12345',
      contributedOn: '2026-11-03',
      note: 'Teste',
    });
    assert.equal(funded.contributedCents, '12345');
    assert.equal(funded.contributions.length, 1);
    assert.equal(
      (
        await service.contribute(owner.id, goal.id, key, {
          amountCents: '12345',
          contributedOn: '2026-11-03',
          note: 'Teste',
        })
      ).contributions.length,
      1,
    );
    await assert.rejects(
      service.removeContribution(other.id, goal.id, funded.contributions[0].id),
      { status: 404 },
    );
    const cleared = await service.removeContribution(owner.id, goal.id, funded.contributions[0].id);
    assert.equal(cleared.contributedCents, '0');
    assert.equal((await service.update(owner.id, goal.id, { status: 'closed' })).status, 'closed');
    await assert.rejects(
      service.contribute(owner.id, goal.id, randomUUID(), {
        amountCents: '10000',
        contributedOn: '2026-11-03',
        note: null,
      }),
      { status: 404 },
    );
    assert.deepEqual(await service.remove(owner.id, goal.id), { success: true });
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.log(
    'Goals SQL, contributions and owner isolation passed; synthetic records rolled back.',
  );
} finally {
  await db.$disconnect();
}
