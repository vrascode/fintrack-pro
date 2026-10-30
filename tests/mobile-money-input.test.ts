import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalizedCents } from '../apps/mobile/src/demo/input.ts';

test('localized money input parses grouping and decimals as exact cents', () => {
  assert.equal(parseLocalizedCents('1.234,56', 'pt-BR'), 123456n);
  assert.equal(parseLocalizedCents('1234,5', 'pt-BR'), 123450n);
  assert.equal(parseLocalizedCents('1,234.56', 'en'), 123456n);
  assert.equal(parseLocalizedCents('1234.5', 'en'), 123450n);
});

test('localized money input rejects malformed, zero, and excessive precision', () => {
  for (const [value, language] of [
    ['0', 'pt-BR'],
    ['1,234', 'pt-BR'],
    ['1.234', 'en'],
    ['-1.00', 'en'],
    ['abc', 'pt-BR'],
  ] as const) {
    assert.throws(() => parseLocalizedCents(value, language));
  }
});
