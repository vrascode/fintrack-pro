import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiBaseUrl } from '../apps/mobile/src/api/url.ts';

test('web development preserves localhost hostname for same-site session cookies', () => {
  assert.equal(
    resolveApiBaseUrl('http://127.0.0.1:3000/v1', 'web', true, 'localhost'),
    'http://localhost:3000/v1',
  );
  assert.equal(
    resolveApiBaseUrl('http://localhost:3000/v1', 'web', true, '127.0.0.1'),
    'http://127.0.0.1:3000/v1',
  );
  assert.equal(resolveApiBaseUrl(undefined, 'web', true, 'localhost'), 'http://localhost:3000/v1');
  assert.equal(resolveApiBaseUrl(undefined, 'web', true, '127.0.0.1'), 'http://127.0.0.1:3000/v1');
  assert.equal(
    resolveApiBaseUrl(undefined, 'web', true, '192.168.1.20'),
    'http://192.168.1.20:3000/v1',
  );
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

test('Expo Go uses the development computer LAN address, while explicit remote APIs remain authoritative', () => {
  for (const platform of ['android', 'ios']) {
    assert.equal(
      resolveApiBaseUrl(undefined, platform, true, undefined, '192.168.1.20:8083'),
      'http://192.168.1.20:3000/v1',
    );
    assert.equal(
      resolveApiBaseUrl('http://localhost:3107/v1', platform, true, undefined, '192.168.1.20:8083'),
      'http://192.168.1.20:3107/v1',
    );
    assert.equal(
      resolveApiBaseUrl(
        'https://api.example.test/v1',
        platform,
        true,
        undefined,
        '192.168.1.20:8083',
      ),
      'https://api.example.test/v1',
    );
  }
  assert.equal(
    resolveApiBaseUrl('http://127.0.0.1:3107/v1', 'android', true),
    'http://10.0.2.2:3107/v1',
  );
  assert.equal(resolveApiBaseUrl(undefined, 'ios', true), 'http://127.0.0.1:3000/v1');
});
