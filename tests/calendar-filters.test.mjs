import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDayBoundary,
  calendarRangeError,
} from '../src/utils/calendarFilters.ts';

test('invalid query dates do not crash rendering or silently roll into another month', () => {
  for (const value of [
    '',
    'bad',
    '2026-02-30',
    '2026-13-01',
    '2026-01',
    '2026-02-29',
  ])
    assert.equal(calendarDayBoundary(value), undefined);
  assert.ok(calendarDayBoundary('2024-02-29'));
});
test('boundaries include the entire local calendar day', () => {
  const start = new Date(calendarDayBoundary('2026-09-21'));
  const end = new Date(calendarDayBoundary('2026-09-21', true));
  assert.equal(start.getHours(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMilliseconds(), 999);
  assert.equal(start.getDate(), end.getDate());
});
test('reversed ranges fail while open and same-day ranges are supported', () => {
  assert.ok(calendarRangeError('2026-09-22', '2026-09-21'));
  assert.ok(calendarRangeError('invalid', ''));
  assert.equal(calendarRangeError('2026-09-21', '2026-09-21'), undefined);
  assert.equal(calendarRangeError('', '2026-09-21'), undefined);
});
