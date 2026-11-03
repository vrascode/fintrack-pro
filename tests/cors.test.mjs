import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOriginPolicy } from '../apps/api/dist/config/cors.js';
import { createApp } from '../apps/api/dist/app.js';

test('development trusts exact loopback hosts with dynamic ports, including explicit origins', () => {
  const allowed = createOriginPolicy({
    NODE_ENV: 'development',
    CORS_ORIGINS: 'https://app.example.test',
  });
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    for (const port of [8081, 8082, 8083, 49152])
      assert.equal(allowed(`http://${host}:${port}`), true);
  }
  assert.equal(allowed('https://app.example.test'), true);
  for (const origin of [
    undefined,
    '',
    'null',
    '*',
    'file://localhost',
    'http://localhost.evil.test:8083',
    'http://127.0.0.2:8083',
    'http://localhost:8083/path',
    'http://user@localhost:8083',
    'http://localhost:8083?query',
    'http://localhost:8083#hash',
  ]) {
    assert.equal(allowed(origin), false, String(origin));
  }
});

test('production requires exact configured origins and rejects wildcards or malformed configuration', () => {
  const allowed = createOriginPolicy({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.test, https://admin.example.test',
  });
  assert.equal(allowed('https://app.example.test'), true);
  for (const origin of [
    'http://localhost:8083',
    'http://127.0.0.1:8081',
    'https://evil.test',
    'https://app.example.test:8083',
  ])
    assert.equal(allowed(origin), false);
  assert.equal(createOriginPolicy({ NODE_ENV: 'production' })('http://localhost:8083'), false);
  for (const origin of [
    '*',
    'null',
    'https://user:secret@example.test',
    'https://app.example.test/path',
  ]) {
    assert.throws(() => createOriginPolicy({ CORS_ORIGINS: origin }), /CORS_ORIGINS/);
  }
});

test('preflight and authentication use the same policy for dynamic Expo ports', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const root = await app.getUrl();
  for (const origin of [
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://127.0.0.1:49152',
  ]) {
    const response = await fetch(`${root}/v1/auth/register`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,idempotency-key',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('vary'), /Origin/i);
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-methods'), /PATCH/);
    assert.match(response.headers.get('access-control-allow-headers'), /Authorization/i);
    assert.match(response.headers.get('access-control-allow-headers'), /Idempotency-Key/i);
    const invalid = await fetch(`${root}/v1/auth/register`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(invalid.status, 400); // Validation reached; neither CORS nor CSRF rejects it.
    assert.equal(invalid.headers.get('access-control-allow-origin'), origin);
  }
  const headers = { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST' };
  const preflight = await fetch(`${root}/v1/auth/register`, { method: 'OPTIONS', headers });
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  const rejected = await fetch(`${root}/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: headers.Origin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});

test('production HTTP CORS and authentication authorize only the explicit origin list', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, CORS_ORIGINS: process.env.CORS_ORIGINS };
  let app;
  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.test';
    app = await createApp(false);
    await app.listen(0, '127.0.0.1');
    const root = await app.getUrl();
    for (const origin of [
      'https://app.example.test',
      'http://localhost:8083',
      'https://untrusted.example',
    ]) {
      const allowed = origin === 'https://app.example.test';
      const response = await fetch(`${root}/v1/auth/register`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      assert.equal(response.headers.get('access-control-allow-origin'), allowed ? origin : null);
      const invalid = await fetch(`${root}/v1/auth/register`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(invalid.status, allowed ? 400 : 403);
    }
  } finally {
    await app?.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
