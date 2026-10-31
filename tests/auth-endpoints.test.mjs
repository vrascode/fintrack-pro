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
