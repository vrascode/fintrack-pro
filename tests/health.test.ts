import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthSchema } from '@fintrack/shared';
import { createApp } from '../apps/api/dist/app.js';

test('NestJS health works through HTTP and declares only process liveness', async (t) => {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const app = await createApp(false);
  if (configuredDatabaseUrl !== undefined) process.env.DATABASE_URL = configuredDatabaseUrl;
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
  const readiness = await fetch(`${base}/v1/health/ready`);
  assert.equal(readiness.status, 503);
  assert.equal(readiness.headers.get('cache-control'), 'no-store');
  const readinessBody = await readiness.text();
  assert.match(readinessBody, /"scope":"database"/);
  assert.doesNotMatch(readinessBody, /postgresql:|password|127\.0\.0\.1/);
  const invalidRegistration = await fetch(`${base}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid' }),
  });
  assert.equal(invalidRegistration.status, 400);
  const loggedOut = await fetch(`${base}/v1/auth/logout`, { method: 'POST' });
  assert.equal(loggedOut.status, 401);
  assert.equal((await fetch(`${base}/health`)).status, 404);
  assert.equal((await fetch(`${base}/v1/accounts`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/v1/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).status,
    401,
  );
  assert.equal((await fetch(`${base}/v1/health`, { method: 'POST' })).status, 404);
});
