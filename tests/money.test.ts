import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MINOR,
  MIN_MINOR,
  addMoney,
  formatBRL,
  minorUnits,
  minorUnitsSchema,
  multiplyRatio,
  parseDecimal,
  serializeMoney,
  splitMoney,
} from '@fintrack/shared';

test('decimal parsing and addition are exact beyond Number precision', () => {
  assert.equal(addMoney(parseDecimal('0.10'), parseDecimal('0.20')), 30n);
  assert.equal(parseDecimal('90071992547409.93'), 9007199254740993n);
  assert.equal(parseDecimal('-0.01'), -1n);
  assert.equal(parseDecimal('12.3'), 1230n);
  for (const input of ['1,00', '1e3', ' 1', '01', '.1', '1.', 'NaN', '0.001', ''])
    assert.throws(() => parseDecimal(input));
});
test('money JSON accepts only canonical bounded integers', () => {
  assert.equal(minorUnits(serializeMoney(MAX_MINOR)), MAX_MINOR);
  assert.equal(minorUnits(serializeMoney(MIN_MINOR)), MIN_MINOR);
  for (const value of [
    '-0',
    '01',
    '+1',
    '1.0',
    '1e2',
    (MAX_MINOR + 1n).toString(),
    (MIN_MINOR - 1n).toString(),
  ])
    assert.equal(minorUnitsSchema.safeParse(value).success, false);
  assert.throws(() => addMoney(MAX_MINOR, 1n));
  assert.throws(() => addMoney(MIN_MINOR, -1n));
});
test('ratios round half away from zero and reject invalid denominator', () => {
  assert.equal(multiplyRatio(101n, 1n, 2n), 51n);
  assert.equal(multiplyRatio(-101n, 1n, 2n), -51n);
  assert.equal(multiplyRatio(100n, 1n, 3n), 33n);
  assert.equal(multiplyRatio(100n, 2n, 3n), 67n);
  assert.throws(() => multiplyRatio(1n, 1n, 0n));
});
test('installments conserve every cent for positive and negative amounts', () => {
  assert.deepEqual(splitMoney(100n, 3), [34n, 33n, 33n]);
  for (const amount of [0n, 1n, -1n, 100n, -100n, MAX_MINOR, MIN_MINOR]) {
    for (const count of [1, 2, 3, 12, 1200])
      assert.equal(
        splitMoney(amount, count).reduce((a, b) => a + b),
        amount,
      );
  }
  for (const count of [0, -1, 1.5, 1201, NaN]) assert.throws(() => splitMoney(100n, count));
});
test('BRL display preserves exact large amounts and supports privacy', () => {
  assert.equal(formatBRL(9007199254740993n), 'R$ 90.071.992.547.409,93');
  assert.equal(formatBRL(-5n), '-R$ 0,05');
  assert.equal(formatBRL(0n), 'R$ 0,00');
  assert.equal(formatBRL(123n, true), '••••');
});
