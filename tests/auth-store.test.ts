import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthStore } from '../apps/mobile/src/auth/core.ts';

const credentials = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  accessToken: `ft_a_${'a'.repeat(43)}`,
  refreshToken: `ft_r_${'b'.repeat(43)}`,
  expiresAt: '2026-10-30T12:00:00.000Z',
};

function setup(initial: string | null = null) {
  let saved = initial;
  const calls: string[] = [];
  const store = createAuthStore(
    {
      get: async () => saved,
      set: async (value) => {
        saved = value;
      },
      clear: async () => {
        saved = null;
      },
    },
    {
      register: async () => {
        calls.push('register');
      },
      login: async () => {
        calls.push('login');
        return credentials;
      },
      logout: async () => {
        calls.push('logout');
      },
    },
  );
  return {
    store,
    calls,
    get saved() {
      return saved;
    },
  };
}

test('auth store restores valid credentials without storing the password', async () => {
  const fixture = setup(JSON.stringify(credentials));
  await fixture.store.getState().hydrate();
  assert.equal(fixture.store.getState().status, 'authenticated');
  assert.deepEqual(fixture.store.getState().session, credentials);
});

test('first account flow registers then signs in and persists only session credentials', async () => {
  const fixture = setup();
  const success = await fixture.store
    .getState()
    .register(
      { email: 'USER@example.test', password: 'a sufficiently long password phrase' },
      'Android phone',
    );
  assert.equal(success, true);
  assert.deepEqual(fixture.calls, ['register', 'login']);
  assert.equal(fixture.store.getState().status, 'authenticated');
  assert.equal(fixture.saved?.includes('password'), false);
});

test('invalid saved credentials are cleared and logout clears local credentials', async () => {
  const fixture = setup('{invalid');
  await fixture.store.getState().hydrate();
  assert.equal(fixture.store.getState().status, 'anonymous');
  assert.equal(fixture.saved, null);
  await fixture.store.getState().signIn({
    email: 'user@example.test',
    password: 'a sufficiently long password phrase',
    deviceName: 'phone',
  });
  await fixture.store.getState().signOut();
  assert.deepEqual(fixture.calls, ['login', 'logout']);
  assert.equal(fixture.saved, null);
});
