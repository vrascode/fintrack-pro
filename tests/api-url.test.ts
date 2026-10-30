import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiBaseUrl } from '../apps/mobile/src/api/url.ts';

test('web development preserves localhost hostname for same-site session cookies', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'web', true, 'localhost'), 'http://localhost:3000/v1');
  assert.equal(resolveApiBaseUrl(undefined, 'web', true, '127.0.0.1'), 'http://127.0.0.1:3000/v1');
});

test('development API defaults distinguish Android emulator from host platforms', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'android', true), 'http://10.0.2.2:3000/v1');
  assert.equal(resolveApiBaseUrl(undefined, 'web', true), 'http://127.0.0.1:3000/v1');
});

test('production API requires HTTPS and removes a trailing path slash', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.example.test/v1/', 'android', false),
    'https://api.example.test/v1',
  );
  assert.throws(() => resolveApiBaseUrl(undefined, 'android', false), /EXPO_PUBLIC_API_URL/);
  assert.throws(() => resolveApiBaseUrl('http://api.example.test/v1', 'web', false), /HTTPS/);
  assert.throws(() => resolveApiBaseUrl('https://127.0.0.1/v1', 'android', false), /HTTPS/);
});
