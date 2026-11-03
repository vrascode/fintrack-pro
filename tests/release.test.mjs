import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productionApiUrl } from '../scripts/release.mjs';

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
