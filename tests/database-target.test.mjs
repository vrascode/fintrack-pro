import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTestDatabaseUrl } from '../scripts/database.mjs';

test('integration database guard accepts only explicit local test databases', () => {
  assert.equal(
    validateTestDatabaseUrl('postgresql://localhost:5433/fintrack_test'),
    'postgresql://localhost:5433/fintrack_test',
  );
  for (const url of [
    undefined,
    '',
    'postgresql://localhost/fintrack',
    'postgresql://db.example.com/fintrack_test',
    'postgresql://localhost/fintrack_test?schema=production',
    'postgresql://localhost/fintrack_test#fragment',
    'postgresql://localhost/%66intrack_test',
    'https://localhost/fintrack_test',
  ]) {
    assert.throws(() => validateTestDatabaseUrl(url));
  }
});
