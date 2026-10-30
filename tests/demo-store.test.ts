import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DATA_KEY, createDemoStore } from '../apps/mobile/src/demo/core.ts';
import type { DemoStorage } from '../apps/mobile/src/demo/core.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: DemoStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
  };
  return { storage, values, writes };
}

test('demo persists under an isolated key and never touches unrelated personal records', async () => {
  const { storage, values, writes } = memoryStorage({
    'fintrack.personal.v1': '{"account":"preserved"}',
  });
  const store = createDemoStore(storage);
  await store.getState().hydrate();
  assert.equal(await store.getState().enterDemo(), true);
  assert.equal(store.getState().mode, 'demo');
  assert.equal(store.getState().dataset?.isDemo, true);
  assert.deepEqual(writes, [DEMO_DATA_KEY]);

  const personalBeforeRestore = values.get('fintrack.personal.v1');
  assert.equal(await store.getState().restoreDemo(), true);
  assert.equal(values.get('fintrack.personal.v1'), personalBeforeRestore);
  assert.ok(values.has(DEMO_DATA_KEY));
});

test('leaving the demo preserves it and a new store restores the saved inactive mode', async () => {
  const { storage } = memoryStorage();
  const first = createDemoStore(storage);
  await first.getState().hydrate();
  await first.getState().enterDemo();
  assert.equal(await first.getState().exitDemo(), true);
  assert.equal(first.getState().mode, 'inactive');

  const reopened = createDemoStore(storage);
  await reopened.getState().hydrate();
  assert.equal(reopened.getState().mode, 'inactive');
  assert.equal(reopened.getState().dataset?.isDemo, true);
  assert.equal(await reopened.getState().enterDemo(), true);
  assert.equal(reopened.getState().mode, 'demo');
});

test('demo edits validate and persist without modifying state on invalid data', async () => {
  const { storage, values } = memoryStorage();
  const store = createDemoStore(storage);
  await store.getState().hydrate();
  await store.getState().enterDemo();
  const previous = store.getState().dataset;
  assert.ok(previous);

  assert.equal(
    await store.getState().updateDataset((dataset) => ({ ...dataset, demoLabel: 'personal' })),
    false,
  );
  assert.equal(store.getState().error, 'invalid');
  assert.deepEqual(store.getState().dataset, previous);

  const expense = {
    id: 'demo-extra-expense',
    kind: 'expense' as const,
    amountCents: '2500',
    date: previous.asOfDate,
    status: 'posted' as const,
    accountId: 'checking',
    categoryId: 'other',
    description: 'Demo-only expense',
  };
  assert.equal(
    await store.getState().updateDataset((dataset) => ({
      ...dataset,
      transactions: [...dataset.transactions, expense],
    })),
    true,
  );
  assert.equal(
    store.getState().dataset?.transactions.some(({ id }) => id === expense.id),
    true,
  );
  const persisted = JSON.parse(values.get(DEMO_DATA_KEY) ?? 'null') as {
    dataset?: { isDemo?: boolean };
  };
  assert.equal(persisted.dataset?.isDemo, true);
});

test('invalid demo storage is not silently overwritten; explicit restore recovers only demo state', async () => {
  const { storage, values, writes } = memoryStorage({
    [DEMO_DATA_KEY]: '{broken',
    'fintrack.personal.v1': 'private-sentinel',
  });
  const store = createDemoStore(storage);
  await store.getState().hydrate();
  assert.equal(store.getState().error, 'invalid');
  assert.equal(await store.getState().enterDemo(), false);
  assert.deepEqual(writes, []);

  assert.equal(await store.getState().restoreDemo(), true);
  assert.equal(store.getState().mode, 'demo');
  assert.equal(values.get('fintrack.personal.v1'), 'private-sentinel');
  assert.deepEqual(writes, [DEMO_DATA_KEY]);
});

test('read and write failures stay explicit and can be retried', async () => {
  let failRead = true;
  let failWrite = false;
  const values = new Map<string, string>();
  const store = createDemoStore({
    getItem: async (key) => {
      if (failRead) throw new Error('storage unavailable');
      return values.get(key) ?? null;
    },
    setItem: async (key, value) => {
      if (failWrite) throw new Error('quota');
      values.set(key, value);
    },
  });
  await store.getState().hydrate();
  assert.equal(store.getState().error, 'read');
  assert.equal(await store.getState().restoreDemo(), false);
  failRead = false;
  await store.getState().hydrate();
  failWrite = true;
  assert.equal(await store.getState().enterDemo(), false);
  assert.equal(store.getState().dataset, null);
  assert.equal(store.getState().error, 'write');
  failWrite = false;
  assert.equal(await store.getState().enterDemo(), true);
  assert.equal(store.getState().mode, 'demo');
});
