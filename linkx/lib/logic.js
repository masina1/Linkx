// Pure, dependency-free logic. Safe to import in Node and in the browser.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_SETTINGS = {
  openIn: 'newTab',        // 'newTab' | 'newWindow'
  autoOpenOnStartup: false,
  showDayBadge: true,
};

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
  const settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  const links = Array.isArray(s.links) ? s.links : [];
  return { settings, links };
}
