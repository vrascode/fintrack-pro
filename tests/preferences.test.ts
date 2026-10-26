import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createPreferences, type PreferenceStorage } from '../apps/mobile/src/preferences/core.ts';

async function diskStorage() {
  const base = resolve('.cache/tests');
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(join(base, 'preferences-'));
  const storage: PreferenceStorage = {
    getItem: async (key) => {
      try {
        return await readFile(join(dir, key), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    setItem: (key, value) => writeFile(join(dir, key), value, 'utf8'),
    removeItem: (key) => rm(join(dir, key), { force: true }),
  };
  return { storage, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
test('preferences survive store recreation using real disk persistence', async (t) => {
  const { storage, cleanup } = await diskStorage();
  t.after(cleanup);
  const first = createPreferences(storage);
  await first.getState().hydrate();
  assert.equal(first.getState().status, 'ready');
  await first.getState().update({ theme: 'dark', hideAmounts: true });
  const restarted = createPreferences(storage);
  await restarted.getState().hydrate();
  assert.deepEqual(restarted.getState().value, { version: 1, theme: 'dark', hideAmounts: true });
  await restarted.getState().reset();
  await first.getState().hydrate();
  assert.equal(first.getState().value.theme, 'system');
});
test('corruption is explicit and can be reset without silently overwriting data', async () => {
  for (const raw of ['{', '{"version":2}', '{"version":1,"theme":"dark","hideAmounts":"false"}']) {
    let writes = 0;
    const store = createPreferences({
      getItem: async () => raw,
      setItem: async () => {
        writes++;
      },
      removeItem: async () => undefined,
    });
    await store.getState().hydrate();
    assert.equal(store.getState().error, 'invalid');
    assert.equal(await store.getState().update({ theme: 'light' }), false);
    assert.equal(writes, 0);
    assert.equal(await store.getState().reset(), true);
    assert.equal(store.getState().status, 'ready');
  }
});
test('read failures are retryable and edits stay blocked until recovery', async () => {
  let fail = true;
  const store = createPreferences({
    getItem: async () => {
      if (fail) throw Error('disk');
      return null;
    },
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
  await store.getState().hydrate();
  assert.equal(store.getState().error, 'read');
  assert.equal(await store.getState().update({ theme: 'dark' }), false);
  fail = false;
  await store.getState().hydrate();
  assert.equal(store.getState().status, 'ready');
});
test('write failure preserves committed settings; later retry succeeds', async () => {
  let fail = true;
  const store = createPreferences({
    getItem: async () => null,
    setItem: async () => {
      if (fail) throw Error('quota');
    },
    removeItem: async () => {
      throw Error('disk');
    },
  });
  await store.getState().hydrate();
  assert.equal(await store.getState().update({ theme: 'dark' }), false);
  assert.equal(store.getState().value.theme, 'system');
  assert.equal(store.getState().error, 'write');
  assert.equal(store.getState().saving, false);
  fail = false;
  assert.equal(await store.getState().update({ theme: 'dark' }), true);
  assert.equal(store.getState().error, null);
  assert.equal(await store.getState().reset(), false);
  assert.equal(store.getState().value.theme, 'dark');
});
test('overlapping updates merge in order and persist both fields', async (t) => {
  const { storage, cleanup } = await diskStorage();
  t.after(cleanup);
  const store = createPreferences(storage);
  const hydration = store.getState().hydrate();
  const theme = store.getState().update({ theme: 'dark' });
  const privacy = store.getState().update({ hideAmounts: true });
  await Promise.all([hydration, theme, privacy]);
  const restarted = createPreferences(storage);
  await restarted.getState().hydrate();
  assert.deepEqual(restarted.getState().value, { version: 1, theme: 'dark', hideAmounts: true });
});
