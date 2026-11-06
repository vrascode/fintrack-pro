import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { productionApiUrl, releaseEnvironment, exportWeb } from '../scripts/release.mjs';

test('release loads root public configuration before validation and preserves environment precedence', () => {
  mkdirSync('.local', { recursive: true });
  const path = resolve(mkdtempSync(resolve('.local', 'release-env-')), '.env');
  // Syntax-only fixture; never exported or used as a production endpoint.
  writeFileSync(path, 'EXPO_PUBLIC_API_URL=https://api.fintrack.app/v1/\nDATABASE_URL=private\n');
  assert.deepEqual(releaseEnvironment({ CI: '1' }, path), {
    CI: '1',
    EXPO_PUBLIC_API_URL: 'https://api.fintrack.app/v1',
  });
  for (const value of ['', 'http://localhost:3000/v1']) {
    assert.throws(() => releaseEnvironment({ EXPO_PUBLIC_API_URL: value }, path));
  }
  writeFileSync(path, 'EXPO_PUBLIC_API_URL=http://localhost:3000/v1\n');
  assert.equal(
    releaseEnvironment({ EXPO_PUBLIC_API_URL: 'https://api.fintrack.app/v1' }, path)
      .EXPO_PUBLIC_API_URL,
    'https://api.fintrack.app/v1',
  );
  assert.throws(() => releaseEnvironment({}, path));
  assert.throws(() => releaseEnvironment({}, resolve(path, 'missing')));
});

test('release rejects local, placeholder and credential-bearing endpoints', () => {
  for (const url of [
    undefined,
    '',
    'http://api.fintrack.app/v1',
    'https://localhost/v1',
    'https://127.0.0.1/v1',
    'https://[::1]/v1',
    'https://api.invalid/v1',
    'https://api.example.test/v1',
    'https://api.example.com/v1',
    'https://user:secret@api.fintrack.app/v1',
    'https://api.fintrack.app/v1?token=secret',
    'https://api.fintrack.app',
  ]) {
    assert.throws(() => productionApiUrl(url));
  }
  // Syntax-only sample: no request is sent and domain ownership is not asserted.
  assert.equal(productionApiUrl('https://api.fintrack.app/v1/'), 'https://api.fintrack.app/v1');
});

test('web release anchors paths to the repository and reports child failures', () => {
  let invocation;
  const environment = { CI: '1', EXPO_PUBLIC_API_URL: 'https://api.fintrack.app/v1' };
  exportWeb(environment, (...args) => {
    invocation = args;
    return { status: 0 };
  });
  assert.equal(invocation[0], process.execPath);
  assert.equal(invocation[1][0], resolve(import.meta.dirname, '../scripts/expo.mjs'));
  assert.deepEqual(invocation[1].slice(1), ['export', '--platform', 'web']);
  assert.equal(
    invocation[2].cwd,
    resolve(import.meta.dirname, '..') + (process.platform === 'win32' ? '\\' : '/'),
  );
  assert.equal(invocation[2].env.FINTRACK_RELEASE, '1');
  assert.equal(invocation[2].env.EXPO_PUBLIC_API_URL, environment.EXPO_PUBLIC_API_URL);
  assert.equal(environment.FINTRACK_RELEASE, undefined);
  assert.throws(() => exportWeb(environment, () => ({ status: 7 })), { exitCode: 7 });
  assert.throws(
    () => exportWeb(environment, () => ({ status: null, signal: 'SIGTERM' })),
    /SIGTERM/,
  );
  assert.throws(
    () => exportWeb(environment, () => ({ error: new Error('ENOENT') })),
    /Could not start/,
  );
});
