import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expoEnvironment } from '../scripts/expo.mjs';

test('Expo commands load only the public API URL from the monorepo root and respect shell overrides', () => {
  mkdirSync('.local', { recursive: true });
  const fixture = mkdtempSync(resolve('.local', 'expo-env-'));
  const path = resolve(fixture, '.env');
  writeFileSync(
    path,
    'EXPO_PUBLIC_API_URL=http://192.168.1.20:3107/v1\nDATABASE_URL=private-test-value\n',
  );
  assert.deepEqual(expoEnvironment({ CI: '1' }, path), {
    CI: '1',
    EXPO_PUBLIC_API_URL: 'http://192.168.1.20:3107/v1',
  });
  assert.deepEqual(expoEnvironment({ EXPO_PUBLIC_API_URL: 'https://api.example.test/v1' }, path), {
    EXPO_PUBLIC_API_URL: 'https://api.example.test/v1',
  });
  assert.deepEqual(expoEnvironment({ CI: '1' }, resolve(fixture, 'missing')), { CI: '1' });
});
