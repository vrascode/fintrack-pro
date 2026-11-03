import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../apps/api/dist/app.js';

test('identity endpoints reject missing grants and untrusted refresh origins', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/v1/auth`;
  assert.equal((await fetch(`${base}/me`)).status, 401);
  assert.equal((await fetch(`${base}/refresh`, { method: 'POST' })).status, 401);
  assert.equal(
    (
      await fetch(`${base}/refresh`, {
        method: 'POST',
        headers: { Origin: 'https://untrusted.example' },
      })
    ).status,
    403,
  );
});

test('authentication bursts are bounded before password or database work', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const url = `${await app.getUrl()}/v1/auth/login`;
  for (let attempt = 0; attempt < 30; attempt++) {
    assert.equal((await fetch(url, { method: 'POST' })).status, 400);
  }
  const limited = await fetch(url, { method: 'POST' });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('each refresh attempt counts once toward the authentication limit', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const url = `${await app.getUrl()}/v1/auth/refresh`;
  for (let attempt = 0; attempt < 30; attempt++) {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  }
  assert.equal((await fetch(url, { method: 'POST' })).status, 429);
});
