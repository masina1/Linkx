import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, DEFAULT_SETTINGS, todayIndex, dayAbbrev, linksForToday,
  normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays, withDefaults,
  MAX_PROFILES, CONFIG_VERSION, DEFAULT_PROFILE_COLOR, PALETTE, makeProfile,
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

test('withDefaults wraps legacy settings/links into the Default profile', () => {
  const merged = withDefaults({ settings: { openIn: 'newWindow' }, links: [{ id: 'x' }] });
  const p = merged.profiles[0];
  assert.equal(p.settings.openIn, 'newWindow');
  assert.equal(p.settings.showDayBadge, true); // from defaults
  assert.equal(p.links.length, 1);
});

test('PALETTE has 20 swatches and starts with the default green', () => {
  assert.equal(PALETTE.length, 20);
  assert.equal(PALETTE[0], DEFAULT_PROFILE_COLOR);
  assert.equal(DEFAULT_PROFILE_COLOR, '#16a34a');
});

test('makeProfile fills defaults and keeps a provided id', () => {
  const p = makeProfile({ id: 'x', name: 'Work' });
  assert.equal(p.id, 'x');
  assert.equal(p.name, 'Work');
  assert.equal(p.color, DEFAULT_PROFILE_COLOR);
  assert.equal(p.settings.showDayBadge, true); // from DEFAULT_SETTINGS
  assert.deepEqual(p.links, []);
});

test('withDefaults migrates v1 {settings, links} into one Default profile losslessly', () => {
  const v1 = { settings: { openIn: 'newWindow' }, links: [{ id: 'a', url: 'https://a' }] };
  const c = withDefaults(v1);
  assert.equal(c.version, CONFIG_VERSION);
  assert.equal(c.profiles.length, 1);
  assert.equal(c.profiles[0].name, 'Default');
  assert.equal(c.profiles[0].color, DEFAULT_PROFILE_COLOR);
  assert.equal(c.profiles[0].settings.openIn, 'newWindow');
  assert.equal(c.profiles[0].links.length, 1);
  assert.equal(c.activeProfileId, c.profiles[0].id);
});

test('withDefaults on empty input creates one empty Default profile', () => {
  const c = withDefaults(undefined);
  assert.equal(c.profiles.length, 1);
  assert.equal(c.profiles[0].name, 'Default');
  assert.deepEqual(c.profiles[0].links, []);
  assert.equal(c.activeProfileId, c.profiles[0].id);
});

test('withDefaults passes through v2, clamps to 4, and repairs a bad activeProfileId', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000000' }));
  const c = withDefaults({ version: 2, activeProfileId: 'missing', profiles: many });
  assert.equal(c.profiles.length, 4);
  assert.equal(c.activeProfileId, 'p0'); // repaired to first
});
