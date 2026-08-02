// Pure, dependency-free logic. Safe to import in Node and in the browser.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_SETTINGS = {
  openIn: 'newTab',        // 'newTab' | 'newWindow'
  autoOpenOnStartup: false,
  showDayBadge: true,
};

export const CONFIG_VERSION = 2;
export const MAX_PROFILES = 5;
export const DEFAULT_PROFILE_COLOR = '#16a34a';

// 20 curated, legible swatches. The first five are ordered to be visually
// distinct (green, blue, red, orange, teal) so auto-assigned profile colors
// never look alike; the rest fill out the picker. Index 0 is the brand green.
export const PALETTE = [
  '#16a34a', '#2563eb', '#dc2626', '#ea580c', '#0d9488',
  '#059669', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#9333ea', '#c026d3', '#db2777', '#e11d48', '#d97706',
  '#ca8a04', '#65a30d', '#475569', '#57534e', '#52525b',
];

// Friendly default names suggested for the 2nd, 3rd, 4th, 5th profiles.
export const PROFILE_NAME_SUGGESTIONS = ['Work', 'Dev', 'Gaming', 'YouTube'];

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

export function getActiveProfile(config) {
  return config.profiles.find((p) => p.id === config.activeProfileId) || config.profiles[0];
}

export function nextUnusedColor(config) {
  const used = new Set(config.profiles.map((p) => p.color));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[0];
}

export function addProfile(config, overrides = {}) {
  if (config.profiles.length >= MAX_PROFILES) return config;
  const profile = makeProfile({
    ...overrides,
    name: overrides.name
      || PROFILE_NAME_SUGGESTIONS[config.profiles.length - 1]
      || `Profile ${config.profiles.length + 1}`,
    color: overrides.color || nextUnusedColor(config),
  });
  return { ...config, profiles: [...config.profiles, profile] };
}

export function renameProfile(config, id, name) {
  return {
    ...config,
    profiles: config.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
  };
}

export function setProfileColor(config, id, color) {
  return {
    ...config,
    profiles: config.profiles.map((p) => (p.id === id ? { ...p, color } : p)),
  };
}

export function deleteProfile(config, id) {
  if (config.profiles.length <= 1) return config;
  if (id === config.profiles[0].id) return config; // the default profile is permanent
  const profiles = config.profiles.filter((p) => p.id !== id);
  const activeProfileId = config.activeProfileId === id ? profiles[0].id : config.activeProfileId;
  return { ...config, activeProfileId, profiles };
}

export function setActiveProfile(config, id) {
  if (!config.profiles.some((p) => p.id === id)) return config;
  return { ...config, activeProfileId: id };
}
