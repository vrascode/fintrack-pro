import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthSchema } from '@fintrack/shared';
import { createApp } from '../apps/api/dist/app.js';

test('NestJS health works through HTTP and declares only process liveness', async (t) => {
  const app = await createApp(false);
  t.after(async () => {
    await app.close();
  });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const response = await fetch(`${base}/v1/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(healthSchema.parse(await response.json()), {
    service: 'fintrack-api',
    status: 'ok',
    scope: 'process',
  });
  assert.equal((await fetch(`${base}/health`)).status, 404);
  assert.equal((await fetch(`${base}/v1/accounts`)).status, 404);
  assert.equal((await fetch(`${base}/v1/health`, { method: 'POST' })).status, 404);
});
