import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, calendarDateSchema, dateInTimeZone, daysInMonth } from '@fintrack/shared';

test('calendar validation rejects normalized invalid dates', () => {
  for (const value of [
    '2025-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-01',
    '0000-01-01',
    '2026-1-1',
    '2026-01-00',
    '2026-01-01T00:00:00Z',
  ])
    assert.equal(calendarDateSchema.safeParse(value).success, false);
  for (const value of ['2000-02-29', '2024-02-29', '0001-01-01', '9999-12-31'])
    assert.equal(calendarDateSchema.safeParse(value).success, true);
  assert.equal(daysInMonth(2100, 2), 28);
});
test('month arithmetic clamps day and handles year transitions', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonths('2026-01-31', -1), '2025-12-31');
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28');
  assert.throws(() => addMonths('0001-01-01', -1));
  assert.throws(() => addMonths('9999-12-31', 1));
  assert.throws(() => addMonths('2026-01-01', 0.5));
});
test('business date follows named timezone, independent of host timezone', () => {
  const instant = new Date('2026-10-26T01:00:00Z');
  assert.equal(dateInTimeZone(instant), '2026-10-25');
  assert.equal(dateInTimeZone(instant, 'UTC'), '2026-10-26');
  assert.throws(() => dateInTimeZone(new Date('invalid')));
  assert.throws(() => dateInTimeZone(instant, 'invalid'));
});
