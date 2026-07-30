import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, DEFAULT_SETTINGS, todayIndex, dayAbbrev, linksForToday,
  normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays, withDefaults,
} from '../lib/logic.js';

test('DAYS is Monday-first', () => {
  assert.deepEqual(DAYS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('todayIndex maps JS Sunday(0) to 6 and Monday(1) to 0', () => {
  assert.equal(todayIndex(new Date('2026-07-27T12:00:00')), 0); // Monday
  assert.equal(todayIndex(new Date('2026-07-26T12:00:00')), 6); // Sunday
});

test('dayAbbrev returns the abbreviation', () => {
  assert.equal(dayAbbrev(3), 'Thu');
});

test('linksForToday filters by day and sorts by order', () => {
  const links = [
    { id: 'a', title: 'A', url: 'https://a', days: [false, true, false, false, false, false, false], order: 2 },
    { id: 'b', title: 'B', url: 'https://b', days: [false, true, false, false, false, false, false], order: 0 },
    { id: 'c', title: 'C', url: 'https://c', days: [true, false, false, false, false, false, false], order: 1 },
  ];
  const result = linksForToday(links, 1); // Tuesday
  assert.deepEqual(result.map((l) => l.id), ['b', 'a']);
});

test('linksForToday returns empty array when nothing matches', () => {
  assert.deepEqual(linksForToday([], 0), []);
});

test('normalizeUrl prepends https when no scheme', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
});

test('normalizeUrl keeps existing http(s) scheme', () => {
  assert.equal(normalizeUrl('http://example.com/x'), 'http://example.com/x');
});

test('normalizeUrl trims whitespace', () => {
  assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
});

test('normalizeUrl rejects empty and non-http schemes', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl('ftp://example.com'), null);
  assert.equal(normalizeUrl(42), null);
});

test('day-set helpers', () => {
  assert.deepEqual(emptyDays(), [false, false, false, false, false, false, false]);
  assert.deepEqual(everydayDays(), [true, true, true, true, true, true, true]);
  assert.deepEqual(weekdayDays(), [true, true, true, true, true, false, false]);
  assert.deepEqual(weekendDays(), [false, false, false, false, false, true, true]);
});

test('withDefaults fills settings and coerces links', () => {
  assert.deepEqual(withDefaults(undefined), { settings: DEFAULT_SETTINGS, links: [] });
  const merged = withDefaults({ settings: { openIn: 'newWindow' }, links: [{ id: 'x' }] });
  assert.equal(merged.settings.openIn, 'newWindow');
  assert.equal(merged.settings.showDayBadge, true); // from defaults
  assert.equal(merged.links.length, 1);
});
