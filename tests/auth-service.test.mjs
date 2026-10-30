import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from '../apps/api/dist/identity/auth.service.js';

test('registration stores a password hash and login atomically persists opaque sessions', async () => {
  const users = new Map();
  const sessions = [];
  const refreshTokens = [];
  const db = {
    user: {
      async create({ data, select }) {
        assert.deepEqual(select, { id: true, email: true });
        const user = { id: 'user-1', email: data.email, passwordHash: data.passwordHash };
        users.set(data.email, user);
        return { id: user.id, email: user.email };
      },
      async findUnique({ where }) {
        return users.get(where.email) ?? null;
      },
    },
    async $transaction(work) {
      return work({
        session: { create: async ({ data }) => sessions.push(data) },
        refreshToken: { create: async ({ data }) => refreshTokens.push(data) },
      });
    },
  };
  const auth = new AuthService({ db });
  const password = 'a private long password phrase';
  const user = await auth.register({ email: ' PERSON@example.test ', password });
  assert.deepEqual(user, { id: 'user-1', email: 'person@example.test' });
  const stored = users.get(user.email);
  assert.notEqual(stored.passwordHash, password);
  assert.match(stored.passwordHash, /^scrypt\$/);

  const result = await auth.login({ email: user.email, password, deviceName: 'My phone' });
  assert.equal(result.userId, user.id);
  assert.match(result.accessToken, /^ft_a_/);
  assert.match(result.refreshToken, /^ft_r_/);
  assert.equal(sessions.length, 1);
  assert.equal(refreshTokens.length, 1);
  assert.equal(sessions[0].accessTokenHash === result.accessToken, false);
  assert.equal(refreshTokens[0].tokenHash === result.refreshToken, false);
});
