// Pure, dependency-free logic. Safe to import in Node and in the browser.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_SETTINGS = {
  openIn: 'newTab',        // 'newTab' | 'newWindow'
  autoOpenOnStartup: false,
  showDayBadge: true,
};

export const CONFIG_VERSION = 2;
export const MAX_PROFILES = 4;
export const DEFAULT_PROFILE_COLOR = '#16a34a';

// 20 curated, legible swatches. Index 0 is the brand green (the default).
export const PALETTE = [
  '#16a34a', '#059669', '#0d9488', '#0891b2', '#0284c7',
  '#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c026d3',
  '#db2777', '#e11d48', '#dc2626', '#ea580c', '#d97706',
  '#ca8a04', '#65a30d', '#475569', '#57534e', '#52525b',
];

function genId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

export function makeProfile(overrides = {}) {
  return {
    id: overrides.id || genId(),
    name: overrides.name || 'Profile',
    color: overrides.color || DEFAULT_PROFILE_COLOR,
    settings: { ...DEFAULT_SETTINGS, ...(overrides.settings || {}) },
    links: Array.isArray(overrides.links) ? overrides.links : [],
  };
}

// JS Date.getDay(): Sun=0..Sat=6. We want Mon=0..Sun=6.
export function todayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

export function dayAbbrev(index) {
  return DAYS[index];
}

export function linksForToday(links, dayIndex) {
  return (links || [])
    .filter((l) => Array.isArray(l.days) && l.days[dayIndex])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = 'https://' + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

export function emptyDays() {
  return [false, false, false, false, false, false, false];
}

export function everydayDays() {
  return [true, true, true, true, true, true, true];
}

export function weekdayDays() {
  return [true, true, true, true, true, false, false];
}

export function weekendDays() {
  return [false, false, false, false, false, true, true];
}

export function withDefaults(stored) {
  const s = stored || {};

  // v2: validate, clamp to MAX_PROFILES, repair active id.
  if (Array.isArray(s.profiles) && s.profiles.length) {
    const profiles = s.profiles.slice(0, MAX_PROFILES).map((p) => makeProfile(p));
    const active = profiles.some((p) => p.id === s.activeProfileId)
      ? s.activeProfileId
      : profiles[0].id;
    return { version: CONFIG_VERSION, activeProfileId: active, profiles };
  }

  // v1 {settings, links}: wrap losslessly into one Default profile.
  if (s.settings || s.links) {
    const p = makeProfile({ name: 'Default', settings: s.settings, links: s.links });
    return { version: CONFIG_VERSION, activeProfileId: p.id, profiles: [p] };
  }

  // Empty / unknown: one empty Default profile.
  const p = makeProfile({ name: 'Default' });
  return { version: CONFIG_VERSION, activeProfileId: p.id, profiles: [p] };
}
