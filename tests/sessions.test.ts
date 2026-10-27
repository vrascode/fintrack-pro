import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acceptsAccess,
  createSession,
  revokeSession,
  rotateSession,
  sessionPolicy,
} from '../apps/api/dist/identity/sessions.js';
import { issueToken } from '../apps/api/dist/identity/tokens.js';

const start = new Date('2026-10-27T12:00:00.000Z');
const owner = 'b5d5eca2-1f70-400e-911e-7d6d127fe0e9';
const day = 24 * 60 * 60_000;
const after = (ms: number) => new Date(start.getTime() + ms);

test('sessions issue separate credentials and accept access only before exact expiration', () => {
  const { session, refresh, credentials } = createSession(owner, ' Test device ', start);
  assert.equal(session.userId, owner);
  assert.equal(session.deviceName, 'Test device');
  assert.equal(refresh.sessionId, session.id);
  assert.equal(acceptsAccess(session, credentials.accessToken, start), true);
  assert.equal(
    acceptsAccess(session, credentials.accessToken, after(sessionPolicy.accessMs)),
    false,
  );
  assert.equal(acceptsAccess(session, credentials.refreshToken, start), false);
  assert.equal(acceptsAccess(session, credentials.accessToken, after(-1)), false);
  const stored = JSON.stringify({ session, refresh });
  assert.equal(stored.includes(credentials.accessToken), false);
  assert.equal(stored.includes(credentials.refreshToken), false);
});

test('refresh rotation consumes the old token and invalidates the previous access credential', () => {
  const first = createSession(owner, 'Device', start);
  const rotated = rotateSession(
    first.session,
    first.refresh,
    first.credentials.refreshToken,
    after(1),
  );
  assert.equal(rotated.status, 'rotated');
  if (rotated.status !== 'rotated') return;
  assert.equal(rotated.consumed.consumedAt?.getTime(), after(1).getTime());
  assert.equal(first.refresh.consumedAt, null);
  assert.equal(rotated.grant.session.id, first.session.id);
  assert.equal(
    rotated.grant.session.absoluteExpiresAt.getTime(),
    first.session.absoluteExpiresAt.getTime(),
  );
  assert.notEqual(rotated.grant.refresh.tokenHash, first.refresh.tokenHash);
  assert.equal(
    acceptsAccess(rotated.grant.session, first.credentials.accessToken, after(1)),
    false,
  );
  assert.equal(
    acceptsAccess(rotated.grant.session, rotated.grant.credentials.accessToken, after(1)),
    true,
  );
});

test('replaying a consumed refresh token revokes its whole device session', () => {
  const first = createSession(owner, 'Device', start);
  const rotated = rotateSession(
    first.session,
    first.refresh,
    first.credentials.refreshToken,
    after(1),
  );
  assert.equal(rotated.status, 'rotated');
  if (rotated.status !== 'rotated') return;
  const replay = rotateSession(
    rotated.grant.session,
    rotated.consumed,
    first.credentials.refreshToken,
    after(2),
  );
  assert.equal(replay.status, 'replay');
  if (replay.status !== 'replay') return;
  assert.equal(
    acceptsAccess(replay.session, rotated.grant.credentials.accessToken, after(2)),
    false,
  );
  assert.equal(
    rotateSession(
      replay.session,
      rotated.grant.refresh,
      rotated.grant.credentials.refreshToken,
      after(3),
    ).status,
    'invalid',
  );
});

test('invalid, cross-session, future and expired refresh attempts do not issue grants', () => {
  const first = createSession(owner, 'Device', start);
  const second = createSession(owner, 'Other device', start);
  assert.equal(
    rotateSession(first.session, first.refresh, issueToken('refresh').value, start).status,
    'invalid',
  );
  assert.equal(
    rotateSession(first.session, second.refresh, second.credentials.refreshToken, start).status,
    'invalid',
  );
  assert.equal(
    rotateSession(first.session, first.refresh, first.credentials.refreshToken, after(-1)).status,
    'invalid',
  );
  assert.equal(
    rotateSession(
      first.session,
      first.refresh,
      first.credentials.refreshToken,
      first.refresh.expiresAt,
    ).status,
    'invalid',
  );
  assert.equal(first.session.revokedAt, null);
});

test('rotations extend idle expiry but never exceed the absolute 30-day limit', () => {
  let current = createSession(owner, 'Device', start);
  for (const elapsed of [6, 12, 18, 24, 29, 30 - 1 / 1440]) {
    const rotated = rotateSession(
      current.session,
      current.refresh,
      current.credentials.refreshToken,
      after(elapsed * day),
    );
    assert.equal(rotated.status, 'rotated');
    if (rotated.status !== 'rotated') return;
    current = rotated.grant;
    assert.ok(current.session.expiresAt.getTime() <= after(30 * day).getTime());
    assert.ok(current.session.accessExpiresAt.getTime() <= after(30 * day).getTime());
  }
  assert.equal(current.session.accessExpiresAt.getTime(), after(30 * day).getTime());
  assert.equal(
    acceptsAccess(current.session, current.credentials.accessToken, after(30 * day)),
    false,
  );
  assert.equal(
    rotateSession(
      current.session,
      current.refresh,
      current.credentials.refreshToken,
      after(30 * day),
    ).status,
    'invalid',
  );
});

test('consumed refresh history detects replay after token expiry while its session remains active', () => {
  const first = createSession(owner, 'Device', start);
  const rotated = rotateSession(
    first.session,
    first.refresh,
    first.credentials.refreshToken,
    after(6 * day),
  );
  assert.equal(rotated.status, 'rotated');
  if (rotated.status !== 'rotated') return;
  const replay = rotateSession(
    rotated.grant.session,
    rotated.consumed,
    first.credentials.refreshToken,
    after(8 * day),
  );
  assert.equal(replay.status, 'replay');
});

test('logout is idempotent and affects only the selected device', () => {
  const first = createSession(owner, 'Device', start);
  const second = createSession(owner, 'Other device', start);
  const revoked = revokeSession(first.session, after(1));
  assert.equal(acceptsAccess(revoked, first.credentials.accessToken, after(1)), false);
  assert.equal(acceptsAccess(second.session, second.credentials.accessToken, after(1)), true);
  assert.equal(revokeSession(revoked, after(2)).revokedAt?.getTime(), after(1).getTime());
  assert.equal(first.session.revokedAt, null);
  assert.throws(() => createSession(owner, ' ', start), RangeError);
  assert.throws(() => createSession(owner, 'Device', new Date('invalid')), RangeError);
  assert.throws(() => revokeSession(first.session, after(-1)), RangeError);
});
