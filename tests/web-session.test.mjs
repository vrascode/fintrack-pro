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

test('cross-site production refresh cookie works only when explicitly enabled', () => {
  const previousNode = process.env.NODE_ENV;
  const previousCrossSite = process.env.WEB_SESSION_CROSS_SITE;
  try {
    process.env.NODE_ENV = 'production';
    process.env.WEB_SESSION_CROSS_SITE = 'true';
    const cookie = refreshCookie('ft_r_test');
    assert.match(cookie, /HttpOnly; SameSite=None; Path=\/v1\/auth/);
    assert.match(cookie, /; Secure$/);
    assert.doesNotMatch(cookie, /Domain=/);
    process.env.NODE_ENV = 'development';
    assert.match(refreshCookie('ft_r_test'), /SameSite=Strict/);
  } finally {
    if (previousNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNode;
    if (previousCrossSite === undefined) delete process.env.WEB_SESSION_CROSS_SITE;
    else process.env.WEB_SESSION_CROSS_SITE = previousCrossSite;
  }
});

test('untrusted browser origins cannot issue session-changing requests', () => {
  assert.throws(() => assertWebOrigin('https://untrusted.example'), /Origin is not allowed/);
  assert.doesNotThrow(() => assertWebOrigin(undefined)); // Native clients have no Origin.
});

test('cookie-only session restoration requires a trusted browser Origin', async (t) => {
  const app = await createApp(false);
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const root = await app.getUrl();
  const withoutOrigin = await fetch(`${root}/v1/auth/session`, {
    method: 'POST',
    headers: { Cookie: 'fintrack_refresh=forged' },
  });
  assert.equal(withoutOrigin.status, 403);
  const untrusted = await fetch(`${root}/v1/auth/session`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example', Cookie: 'fintrack_refresh=forged' },
  });
  assert.equal(untrusted.status, 403);
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
