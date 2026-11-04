import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { createDatabaseAdapter } from '../apps/api/dist/database/adapter.js';
import { BudgetsService } from '../apps/api/dist/budgets/budgets.service.js';

loadEnvFile('.env');
const target = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/fintrack')
  throw new Error('Budget validation accepts only the local fintrack database.');
const { PrismaClient } = await import('../apps/api/src/generated/prisma/client.ts');
const db = new PrismaClient({ adapter: createDatabaseAdapter(target.href) });
const rollback = new Error('Validated; roll back synthetic records.');

try {
  await db.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: { email: `budget-${randomUUID()}@example.test`, passwordHash: 'validation-only' },
    });
    const other = await tx.user.create({
      data: { email: `budget-${randomUUID()}@example.test`, passwordHash: 'validation-only' },
    });
    const category = await tx.category.create({
      data: { userId: owner.id, name: 'Mercado', kind: 'EXPENSE' },
    });
    const account = await tx.account.create({
      data: {
        userId: owner.id,
        name: 'Conta',
        type: 'CHECKING',
        openingBalanceOn: new Date('2026-01-01'),
      },
    });
    await tx.transaction.create({
      data: {
        userId: owner.id,
        accountId: account.id,
        categoryId: category.id,
        kind: 'EXPENSE',
        amountCents: 60000n,
        description: 'Compra',
        occurredOn: new Date('2026-11-01'),
        idempotencyKey: randomUUID(),
      },
    });
    const service = new BudgetsService({ db: tx });
    const budget = await service.create(owner.id, {
      categoryId: category.id,
      month: '2026-11',
      limitCents: '80000',
    });
    assert.equal(budget.spentCents, '60000');
    assert.equal(budget.limitCents, '80000');
    assert.deepEqual(await service.list(other.id, { month: '2026-11' }), []);
    await assert.rejects(service.update(other.id, budget.id, { limitCents: '90000' }), {
      status: 404,
    });
    await assert.rejects(service.remove(other.id, budget.id), { status: 404 });
    assert.equal(
      (await service.update(owner.id, budget.id, { limitCents: '90000' })).limitCents,
      '90000',
    );
    assert.deepEqual(await service.remove(owner.id, budget.id), { success: true });
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.log('Budget SQL and owner isolation passed; synthetic records rolled back.');
} finally {
  await db.$disconnect();
}
