import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  refreshCookie,
  readRefreshCookie,
  assertWebOrigin,
} from '../apps/api/dist/identity/web-session.js';
import { createApp } from '../apps/api/dist/app.js';
import { publicSession } from '../apps/api/dist/identity/web-session.js';

test('browser session payloads never expose the refresh cookie credential', () => {
  const session = publicSession({
    userId: 'owner',
    sessionId: 'session',
    accessToken: 'access',
    refreshToken: 'private-refresh',
    expiresAt: '2026-10-30T12:00:00Z',
  });
  assert.equal(Object.hasOwn(session, 'refreshToken'), false);
  assert.equal(JSON.stringify(session).includes('private-refresh'), false);
});

test('refresh cookies are HttpOnly, host-scoped and use Secure in production', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const cookie = refreshCookie('ft_r_test');
    assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/v1\/auth/);
    assert.match(cookie, /; Secure$/);
    assert.doesNotMatch(cookie, /Domain=/);
    assert.match(refreshCookie('', true), /Max-Age=0/);
    assert.equal(readRefreshCookie('other=x; fintrack_refresh=ft_r_test; another=y'), 'ft_r_test');
    assert.equal(readRefreshCookie(undefined), '');
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('untrusted browser origins cannot issue session-changing requests', () => {
  assert.throws(() => assertWebOrigin('https://untrusted.example'), /Origin is not allowed/);
  assert.doesNotThrow(() => assertWebOrigin(undefined)); // Native clients have no Origin.
});

test('local frontend CORS permits credentials and rejects an untrusted registration origin', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const root = await app.getUrl();
  const preflight = await fetch(`${root}/v1/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  const rejected = await fetch(`${root}/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(rejected.status, 403);
});
