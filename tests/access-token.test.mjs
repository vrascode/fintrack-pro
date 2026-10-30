import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccessTokenGuard } from '../apps/api/dist/identity/access-token.guard.js';
import { createSession } from '../apps/api/dist/identity/sessions.js';

const contextFor = (request) => ({ switchToHttp: () => ({ getRequest: () => request }) });

test('access guard derives user identity from an active persisted session', async () => {
  const grant = createSession('owner-id', 'phone', new Date());
  const guard = new AccessTokenGuard({
    db: { session: { findUnique: async () => grant.session } },
  });
  const request = { headers: { authorization: `Bearer ${grant.credentials.accessToken}` } };
  assert.equal(await guard.canActivate(contextFor(request)), true);
  assert.equal(request.userId, 'owner-id');
  assert.equal(request.sessionId, grant.session.id);
});

test('access guard rejects malformed and expired credentials', async () => {
  const grant = createSession('owner-id', 'phone', new Date(Date.now() - 60 * 60 * 1000));
  const guard = new AccessTokenGuard({
    db: { session: { findUnique: async () => grant.session } },
  });
  await assert.rejects(
    guard.canActivate(contextFor({ headers: { authorization: 'Bearer invalid' } })),
    { status: 401 },
  );
  await assert.rejects(
    guard.canActivate(
      contextFor({ headers: { authorization: `Bearer ${grant.credentials.accessToken}` } }),
    ),
    { status: 401 },
  );
});
