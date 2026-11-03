import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TransactionChangesService } from '../apps/api/dist/transactions/transaction-changes.service.js';
import { TransactionsService } from '../apps/api/dist/transactions/transactions.service.js';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const accountId = '00000000-0000-4000-8000-000000000003';
const destination = '00000000-0000-4000-8000-000000000004';
const input = {
  kind: 'expense',
  accountId,
  amountCents: '1250',
  date: '2026-01-10',
  description: 'Corrected',
};

function fixture({
  conflict = false,
  unavailable = false,
  auditFailure = false,
  openingDate = '2026-01-01',
} = {}) {
  let row = {
    id,
    userId: owner,
    revision: 1,
    voidedAt: null,
    kind: 'INCOME',
    accountId,
    transferAccountId: null,
    categoryId: null,
    amountCents: 5000n,
    occurredOn: new Date('2026-01-10'),
    description: 'Original',
  };
  let history = [];
  const db = {
    transaction: {
      findFirst: async ({ where }) =>
        where.userId === owner && (!('voidedAt' in where) || row.voidedAt === null)
          ? structuredClone(row)
          : null,
      findUnique: async () => structuredClone(row),
      findUniqueOrThrow: async () => structuredClone(row),
      updateMany: async ({ where, data }) => {
        if (conflict || where.userId !== owner || where.revision !== row.revision || row.voidedAt)
          return { count: 0 };
        row = { ...row, ...data, revision: row.revision + 1 };
        return { count: 1 };
      },
    },
    account: {
      findMany: async ({ where }) =>
        unavailable
          ? []
          : where.id.in.map((key) => ({ id: key, openingBalanceOn: new Date(openingDate) })),
    },
    category: { findFirst: async () => null },
    transactionChange: {
      create: async ({ data }) => {
        if (auditFailure) throw new Error('audit unavailable');
        history.push(data);
      },
    },
    $transaction: async (work) => {
      const before = structuredClone(row);
      const originalHistory = structuredClone(history);
      try {
        return await work(db);
      } catch (error) {
        row = before;
        history = originalHistory;
        throw error;
      }
    },
  };
  return {
    service: new TransactionChangesService({ db }),
    creation: new TransactionsService({ db }),
    row: () => row,
    history: () => history,
  };
}

test('edits preserve an audit snapshot and update exact cents with a new revision', async () => {
  const f = fixture();
  const edited = await f.service.edit(owner, id, { revision: 1, transaction: input });
  assert.equal(edited.amountCents, '1250');
  assert.equal(edited.revision, 2);
  assert.equal(f.history()[0].snapshot.amountCents, '5000');
  assert.equal(f.history()[0].operation, 'edit');
  await assert.rejects(f.service.edit(owner, id, { revision: 1, transaction: input }), {
    status: 409,
  });
  assert.equal(f.history().length, 1);
});

test('removal is logical and repeatable while preserving the idempotency key reservation', async () => {
  const f = fixture();
  await f.service.void(owner, id, { revision: 1 });
  await f.service.void(owner, id, { revision: 1 });
  assert.ok(f.row().voidedAt instanceof Date);
  assert.equal(f.history().length, 1);
  assert.equal(f.history()[0].operation, 'void');
  await assert.rejects(f.creation.create(owner, 'old-key', input), { status: 409 });
  await assert.rejects(f.service.edit(owner, id, { revision: 2, transaction: input }), {
    status: 404,
  });
});

test('mutations reject other owners, stale revisions and invalid bodies', async () => {
  const f = fixture();
  await assert.rejects(f.service.edit(destination, id, { revision: 1, transaction: input }), {
    status: 404,
  });
  await assert.rejects(f.service.void(destination, id, { revision: 1 }), { status: 404 });
  await assert.rejects(f.service.void(owner, id, { revision: 2 }), { status: 409 });
  await assert.rejects(
    f.service.edit(owner, id, { revision: 1, transaction: { ...input, amountCents: '1.25' } }),
    { status: 400 },
  );
  await assert.rejects(f.service.void(owner, '../other', { revision: 1 }), { status: 400 });
  assert.equal(f.history().length, 0);
});

test('edits reject unavailable accounts, categories and dates preceding either account opening', async () => {
  for (const options of [{ unavailable: true }, { openingDate: '2026-02-01' }]) {
    const f = fixture(options);
    await assert.rejects(
      f.service.edit(owner, id, {
        revision: 1,
        transaction: { ...input, kind: 'transfer', transferAccountId: destination },
      }),
      { status: 400 },
    );
    assert.equal(f.row().revision, 1);
  }
  const f = fixture();
  await assert.rejects(
    f.service.edit(owner, id, { revision: 1, transaction: { ...input, categoryId: destination } }),
    { status: 400 },
  );
  await assert.rejects(
    f.service.edit(owner, id, { revision: 1, transaction: { ...input, date: '2099-01-01' } }),
    { status: 400 },
  );
});

test('a concurrent change or audit failure cannot leave a partial edit or removal', async () => {
  for (const options of [{ conflict: true }, { auditFailure: true }]) {
    const f = fixture(options);
    await assert.rejects(f.service.edit(owner, id, { revision: 1, transaction: input }));
    assert.equal(f.row().amountCents, 5000n);
    await assert.rejects(f.service.void(owner, id, { revision: 1 }));
    assert.equal(f.row().voidedAt, null);
    assert.equal(f.history().length, 0);
  }
});
