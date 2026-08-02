import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, DEFAULT_SETTINGS, todayIndex, dayAbbrev, linksForToday,
  normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays, withDefaults,
  MAX_PROFILES, CONFIG_VERSION, DEFAULT_PROFILE_COLOR, PALETTE, makeProfile,
  getActiveProfile, nextUnusedColor, addProfile, renameProfile,
  setProfileColor, deleteProfile, setActiveProfile,
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

test('PALETTE first five are visually distinct defaults (green, blue, red, orange, teal)', () => {
  assert.deepEqual(PALETTE.slice(0, 5), ['#16a34a', '#2563eb', '#dc2626', '#ea580c', '#0d9488']);
  assert.equal(new Set(PALETTE).size, PALETTE.length); // all unique
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

test('withDefaults passes through v2, clamps to MAX_PROFILES, and repairs a bad activeProfileId', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000000' }));
  const c = withDefaults({ version: 2, activeProfileId: 'missing', profiles: many });
  assert.equal(c.profiles.length, 5); // MAX_PROFILES
  assert.equal(c.activeProfileId, 'p0'); // repaired to first
});

function baseConfig() {
  return withDefaults({ version: 2, activeProfileId: 'a', profiles: [
    { id: 'a', name: 'Default', color: PALETTE[0] },
  ] });
}

test('getActiveProfile returns the active profile', () => {
  assert.equal(getActiveProfile(baseConfig()).id, 'a');
});

test('nextUnusedColor skips colors already in use', () => {
  assert.equal(nextUnusedColor(baseConfig()), PALETTE[1]);
});

test('addProfile appends with an unused color and respects MAX_PROFILES', () => {
  let c = baseConfig();
  c = addProfile(c, { name: 'Work' });
  assert.equal(c.profiles.length, 2);
  assert.equal(c.profiles[1].name, 'Work');
  assert.equal(c.profiles[1].color, PALETTE[1]);
  c = addProfile(c); c = addProfile(c); c = addProfile(c); // now 5
  assert.equal(c.profiles.length, 5);
  const capped = addProfile(c); // 6th refused
  assert.equal(capped.profiles.length, 5);
});

test('addProfile suggests Work, Dev, Gaming, YouTube by position when no name given', () => {
  let c = baseConfig(); // 1 profile (Default)
  c = addProfile(c);
  assert.equal(c.profiles[1].name, 'Work');
  c = addProfile(c);
  assert.equal(c.profiles[2].name, 'Dev');
  c = addProfile(c);
  assert.equal(c.profiles[3].name, 'Gaming');
  c = addProfile(c);
  assert.equal(c.profiles[4].name, 'YouTube');
});

test('renameProfile and setProfileColor update only the target', () => {
  let c = addProfile(baseConfig(), { id: 'b', name: 'Work' });
  c = renameProfile(c, 'b', 'Personal');
  c = setProfileColor(c, 'b', '#dc2626');
  const p = c.profiles.find((x) => x.id === 'b');
  assert.equal(p.name, 'Personal');
  assert.equal(p.color, '#dc2626');
  assert.equal(c.profiles.find((x) => x.id === 'a').name, 'Default'); // untouched
});

test('deleteProfile refuses the last profile', () => {
  const c = baseConfig();
  assert.equal(deleteProfile(c, 'a').profiles.length, 1);
});

test('deleteProfile reassigns active when the active profile is removed', () => {
  let c = addProfile(baseConfig(), { id: 'b', name: 'Work' });
  c = setActiveProfile(c, 'b');
  c = deleteProfile(c, 'b');
  assert.equal(c.profiles.length, 1);
  assert.equal(c.activeProfileId, 'a');
});

test('setActiveProfile ignores unknown ids', () => {
  const c = baseConfig();
  assert.equal(setActiveProfile(c, 'nope').activeProfileId, 'a');
});
