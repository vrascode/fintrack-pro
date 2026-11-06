import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseIntegerInput } from '../apps/mobile/src/personal/integer-input.ts';

test('card integer fields reject coercion syntax and enforce field limits', () => {
  for (const value of ['', '0', '-1', '1.0', '1e1', '0x10', 'Infinity', '29', '9'.repeat(1000)]) {
    assert.throws(() => parseIntegerInput(value, 28));
  }
  assert.equal(parseIntegerInput(' 28 ', 28), 28);
  assert.equal(parseIntegerInput('48', 48), 48);
  assert.throws(() => parseIntegerInput('49', 48));
});
