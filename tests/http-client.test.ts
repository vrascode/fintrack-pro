import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiTransport, ApiClientError } from '../apps/mobile/src/api/transport.ts';
import { createAuthStore } from '../apps/mobile/src/auth/core.ts';

test('HTTP distinguishes connection failure, configuration failure, validation and server errors', async () => {
  const unavailable = createApiTransport(
    () => 'http://127.0.0.1/v1',
    async () => {
      throw new TypeError('fetch failed');
    },
  );
  await assert.rejects(unavailable.request('/auth/login'), { status: 0 });
  const invalid = createApiTransport(() => {
    throw new Error('private configuration');
  });
  await assert.rejects(invalid.request('/auth/login'), {
    status: -1,
    message: 'The API URL configuration is invalid.',
  });
  for (const status of [400, 401, 403, 409, 429, 500, 503]) {
    const client = createApiTransport(
      () => 'https://api.example.test/v1',
      async () =>
        new Response(
          JSON.stringify({
            message: status >= 500 ? 'private database details' : 'Safe rejection',
          }),
          { status },
        ),
    );
    await assert.rejects(
      client.request('/auth/login'),
      (error: unknown) =>
        error instanceof ApiClientError &&
        error.status === status &&
        error.message ===
          (status >= 500 ? 'The API could not complete this request.' : 'Safe rejection'),
    );
  }
});

test('HTTP refresh retries once and preserves body, credentials, authorization and idempotency', async () => {
  const calls: Array<Parameters<typeof fetch>[1]> = [];
  let renewals = 0;
  const client = createApiTransport(
    () => 'https://api.example.test/v1',
    async (_url, init) => {
      calls.push(init);
      return new Response(JSON.stringify({ success: true }), {
        status: calls.length === 1 ? 401 : 201,
      });
    },
  );
  client.setSessionRecovery(async (token) => {
    assert.equal(token, 'expired');
    renewals++;
    return 'renewed';
  });
  const result = await client.request('/transactions', {
    method: 'POST',
    token: 'expired',
    body: { amountCents: '123' },
    idempotencyKey: 'same-operation',
  });
  assert.deepEqual(result, { success: true });
  assert.equal(renewals, 1);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call?.credentials, 'include');
    assert.equal(call?.body, '{"amountCents":"123"}');
    assert.equal(new Headers(call?.headers).get('Idempotency-Key'), 'same-operation');
  }
  assert.equal(new Headers(calls[1]?.headers).get('Authorization'), 'Bearer renewed');
  let retries = 0;
  const rejected = createApiTransport(
    () => 'https://api.example.test/v1',
    async () => {
      retries++;
      return new Response('{}', { status: 401 });
    },
  );
  rejected.setSessionRecovery(async () => 'also-rejected');
  await assert.rejects(rejected.request('/accounts', { token: 'expired' }), { status: 401 });
  assert.equal(retries, 2);
});

test('authentication reports distinct HTTP failures without treating server errors as connection errors', async () => {
  for (const [status, expected] of [
    [-1, 'configuration'],
    [0, 'network'],
    [400, 'invalid'],
    [401, 'credentials'],
    [403, 'origin'],
    [409, 'exists'],
    [429, 'rate'],
    [500, 'server'],
    [503, 'unavailable'],
  ] as const) {
    const store = createAuthStore(
      { get: async () => null, set: async () => {}, clear: async () => {} },
      {
        login: async () => {
          throw new ApiClientError(status, 'Safe failure');
        },
        register: async () => {},
        logout: async () => {},
      },
    );
    assert.equal(
      await store.getState().signIn({
        email: 'synthetic@example.test',
        password: 'synthetic-only-passphrase',
        deviceName: 'test',
      }),
      false,
    );
    assert.equal(store.getState().error, expected);
    assert.equal(store.getState().session, null);
  }
});

test('invalid login input is reported as validation before any HTTP request', async () => {
  let calls = 0;
  const store = createAuthStore(
    { get: async () => null, set: async () => {}, clear: async () => {} },
    {
      login: async () => {
        calls++;
        throw new Error('Must not request invalid input');
      },
      register: async () => {},
      logout: async () => {},
    },
  );
  assert.equal(
    await store.getState().signIn({ email: 'invalid', password: 'short', deviceName: 'test' }),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(store.getState().error, 'invalid');
});
