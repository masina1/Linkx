# Linkx Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension ("Linkx") that opens your chosen bookmarks for today's weekday in one click, configured via a dark options page.

**Architecture:** Pure, framework-free MV3 extension with no build step. A background service worker handles the toolbar click, the day badge, and startup auto-open. An options page manages links and settings. All shared logic that can be tested without Chrome lives in a pure `lib/logic.js` module; `lib/storage.js` is a thin `chrome.storage` wrapper. State lives in one object in `chrome.storage.sync` (falling back to `local`).

**Tech Stack:** Vanilla JavaScript (ES modules), HTML, CSS. Node's built-in `node --test` for unit tests. No third-party dependencies, no bundler.

## Global Constraints

- Manifest V3 only. Background is a module service worker (`"type": "module"`).
- No third-party runtime or dev dependencies. No build/bundle step. No network calls.
- All `.js` files are ES modules (`import`/`export`). A `package.json` with `"type": "module"` is present so Node treats `.js` as ESM.
- Day model is **Monday-first**: index 0 = Mon … 6 = Sun. Store per-link days as a 7-element boolean array.
- `chrome.storage` config lives under a single key `"linkxConfig"` holding `{ settings, links }`.
- Brand color is green `#16a34a`. Options UI is dark-themed.
- Extension display name is exactly `Linkx`.
- All code goes under the `linkx/` folder at the repo root (the current working folder will be renamed to `linkx` / pushed to `masina1/Linkx` later — build everything inside `linkx/`).

---

### Task 1: Pure logic module (`lib/logic.js`) with unit tests

**Files:**
- Create: `linkx/package.json`
- Create: `linkx/lib/logic.js`
- Test: `linkx/test/logic.test.js`

**Interfaces:**
- Consumes: nothing (pure, no Chrome/Node APIs).
- Produces (imported by storage.js, background.js, options.js and the test):
  - `DAYS: string[]` — `['Mon','Tue','Wed','Thu','Fri','Sat','Sun']`
  - `DEFAULT_SETTINGS: { openIn: 'newTab'|'newWindow', autoOpenOnStartup: boolean, showDayBadge: boolean }`
  - `todayIndex(date = new Date()): number` — Monday-first 0..6
  - `dayAbbrev(index: number): string`
  - `linksForToday(links: Link[], dayIndex: number): Link[]` — filtered by `days[dayIndex]`, sorted ascending by `order`
  - `normalizeUrl(raw: string): string | null` — trims, prepends `https://` when no scheme, returns normalized href or `null` if invalid / non-http(s)
  - `emptyDays(): boolean[]`, `everydayDays(): boolean[]`, `weekdayDays(): boolean[]`, `weekendDays(): boolean[]`
  - `withDefaults(stored: any): { settings, links }`
  - `Link` shape: `{ id: string, title: string, url: string, days: boolean[], order: number }`

- [ ] **Step 1: Create `linkx/package.json`**

```json
{
  "name": "linkx",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test** — create `linkx/test/logic.test.js`

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd linkx && node --test`
Expected: FAIL — `Cannot find module '../lib/logic.js'` (or import error).

- [ ] **Step 4: Write minimal implementation** — create `linkx/lib/logic.js`

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd linkx && node --test`
Expected: PASS — all tests green (11 tests passing).

- [ ] **Step 6: Commit**

```bash
git add linkx/package.json linkx/lib/logic.js linkx/test/logic.test.js
git commit -m "feat: add pure logic module with unit tests"
```

---

### Task 2: Manifest + generated icons

**Files:**
- Create: `linkx/manifest.json`
- Create: `linkx/tools/make-icons.js`
- Create (generated): `linkx/icons/icon16.png`, `linkx/icons/icon48.png`, `linkx/icons/icon128.png`

**Interfaces:**
- Consumes: nothing.
- Produces: a loadable extension shell. `manifest.json` references `background.js`, `options.html`, and the three icon files (created in later/this task). The action has **no** popup, so `chrome.action.onClicked` (Task 4) will fire.

- [ ] **Step 1: Create the icon generator** — `linkx/tools/make-icons.js`

```js
// Generates simple brand icons (green disc + white ring) as PNGs.
// Pure Node: uses only zlib + fs. Run: node tools/make-icons.js
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4); // transparent
  const c = (size - 1) / 2;
  const R = size * 0.46;
  const ringOuter = size * 0.42;
  const ringInner = size * 0.30;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const i = (y * size + x) * 4;
      if (d <= R) {
        rgba[i] = 0x16; rgba[i + 1] = 0xa3; rgba[i + 2] = 0x4a; rgba[i + 3] = 255;
      }
      if (d >= ringInner && d <= ringOuter) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(OUT, `icon${size}.png`), encodePNG(size, drawIcon(size)));
  console.log(`wrote icons/icon${size}.png`);
}
```

- [ ] **Step 2: Generate the icons**

Run: `cd linkx && node tools/make-icons.js`
Expected output:
```
wrote icons/icon16.png
wrote icons/icon48.png
wrote icons/icon128.png
```

- [ ] **Step 3: Verify the PNGs are valid** (checks the PNG signature bytes)

Run:
```bash
cd linkx && node -e "import('node:fs').then(fs=>{for(const s of [16,48,128]){const b=fs.readFileSync('icons/icon'+s+'.png');const ok=b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;if(!ok)throw new Error('bad png '+s);}console.log('all icons valid');})"
```
Expected: `all icons valid`

- [ ] **Step 4: Create `linkx/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Linkx",
  "version": "1.0.0",
  "description": "Open your chosen bookmarks for today with one click.",
  "permissions": ["bookmarks", "storage", "tabs", "alarms"],
  "action": {
    "default_title": "Linkx — open today's links",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 5: Manually load the extension** (background.js/options.html don't exist yet — expect one specific error, confirming the manifest itself is valid)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked**, select the `linkx/` folder.
3. Expected: the extension appears named **Linkx** with the green icon. There will be a service-worker error ("Cannot find module" / file missing) because `background.js` isn't written yet — that is expected and confirms the manifest parsed. The icon rendering and name prove this task works.

- [ ] **Step 6: Commit**

```bash
git add linkx/manifest.json linkx/tools/make-icons.js linkx/icons/
git commit -m "feat: add manifest and generated brand icons"
```

---

### Task 3: Storage wrapper (`lib/storage.js`)

**Files:**
- Create: `linkx/lib/storage.js`

**Interfaces:**
- Consumes: `withDefaults` from `lib/logic.js`.
- Produces (imported by background.js and options.js):
  - `getConfig(): Promise<{ settings, links }>` — reads key `"linkxConfig"` from `chrome.storage.sync`, falling back to `local`; always returns defaulted shape.
  - `setConfig(config): Promise<{ ok: boolean, fellBack: boolean }>` — writes to `sync`, falling back to `local` on error.
  - `CONFIG_KEY: string` — `"linkxConfig"`.

- [ ] **Step 1: Create `linkx/lib/storage.js`**

```js
// Thin wrapper over chrome.storage. Tested manually in-browser (no Node mock).
import { withDefaults } from './logic.js';

export const CONFIG_KEY = 'linkxConfig';

export async function getConfig() {
  try {
    const r = await chrome.storage.sync.get(CONFIG_KEY);
    return withDefaults(r[CONFIG_KEY]);
  } catch {
    const r = await chrome.storage.local.get(CONFIG_KEY);
    return withDefaults(r[CONFIG_KEY]);
  }
}

export async function setConfig(config) {
  try {
    await chrome.storage.sync.set({ [CONFIG_KEY]: config });
    return { ok: true, fellBack: false };
  } catch {
    try {
      await chrome.storage.local.set({ [CONFIG_KEY]: config });
      return { ok: true, fellBack: true };
    } catch {
      return { ok: false, fellBack: true };
    }
  }
}
```

- [ ] **Step 2: Manually verify in the service-worker console** (after Task 4 the worker loads; for now verify syntactically)

Run: `cd linkx && node --check lib/storage.js`
Expected: no output (exit 0) — file parses as valid ESM.

- [ ] **Step 3: Commit**

```bash
git add linkx/lib/storage.js
git commit -m "feat: add chrome.storage wrapper with local fallback"
```

---

### Task 4: Background service worker (`background.js`)

**Files:**
- Create: `linkx/background.js`

**Interfaces:**
- Consumes: `getConfig` from `lib/storage.js`; `linksForToday`, `todayIndex`, `dayAbbrev` from `lib/logic.js`.
- Produces: runtime behavior — icon click opens today's links; badge shows the day; startup optionally auto-opens; a daily alarm keeps the badge current.

- [ ] **Step 1: Create `linkx/background.js`**

```js
import { getConfig } from './lib/storage.js';
import { linksForToday, todayIndex, dayAbbrev } from './lib/logic.js';

const BADGE_COLOR = '#16a34a';
const DAILY_ALARM = 'linkx-daily-badge';

async function openLinks(urls, openIn) {
  if (!urls.length) return;
  if (openIn === 'newWindow') {
    const win = await chrome.windows.create({ url: urls[0] });
    for (const url of urls.slice(1)) {
      await chrome.tabs.create({ windowId: win.id, url }); // sequential = naturally staggered
    }
  } else {
    for (const url of urls) {
      await chrome.tabs.create({ url });
    }
  }
}

async function openToday() {
  const { settings, links } = await getConfig();
  const urls = linksForToday(links, todayIndex()).map((l) => l.url);
  await openLinks(urls, settings.openIn);
}

async function refreshBadge() {
  const { settings } = await getConfig();
  if (settings.showDayBadge) {
    await chrome.action.setBadgeText({ text: dayAbbrev(todayIndex()) });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// Toolbar icon click -> open today's links.
chrome.action.onClicked.addListener(() => { openToday(); });

// Keep the badge in sync.
chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();
  chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshBadge();
  chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
  const { settings } = await getConfig();
  if (settings.autoOpenOnStartup) openToday();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) refreshBadge();
});

// When settings change from the options page, update the badge immediately.
chrome.storage.onChanged.addListener(() => { refreshBadge(); });
```

- [ ] **Step 2: Syntax check**

Run: `cd linkx && node --check background.js`
Expected: no output (exit 0).

- [ ] **Step 3: Manually verify in Chrome**

1. Go to `chrome://extensions`, click the **reload** (↻) icon on Linkx. The service-worker error from Task 2 should be gone.
2. Click **service worker** to open its console — confirm no errors.
3. The toolbar icon should show a badge with today's day (e.g. `Thu`).
4. (Full open-links behavior is verified after the options page exists in Tasks 6–7.)

- [ ] **Step 4: Commit**

```bash
git add linkx/background.js
git commit -m "feat: add background worker for click, badge, and startup"
```

---

### Task 5: Options page shell (`options.html` + `options.css`)

**Files:**
- Create: `linkx/options.html`
- Create: `linkx/options.css`

**Interfaces:**
- Consumes: nothing yet (script wired in Task 6).
- Produces: the DOM contract that `options.js` (Tasks 6–7) queries by these exact IDs:
  - `#openIn` (select), `#autoOpen` (select), `#showBadge` (select)
  - `#add-title` (input), `#add-url` (input), `#add-btn` (button), `#add-error` (div)
  - `#links-list` (div), `#links-empty` (div)
  - `#bookmarks-tree` (div)

- [ ] **Step 1: Create `linkx/options.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Linkx — Settings</title>
  <link rel="stylesheet" href="options.css" />
</head>
<body>
  <div class="wrap">
    <header class="head">
      <h1>Linkx</h1>
      <p class="sub">Pick the links you want opened for each day. Click the toolbar icon to open today's.</p>
    </header>

    <section class="card">
      <h2>Settings</h2>
      <div class="settings-grid">
        <label class="field">
          <span>Open links in</span>
          <select id="openIn">
            <option value="newTab">New Tab</option>
            <option value="newWindow">New Window</option>
          </select>
        </label>
        <label class="field">
          <span>Auto-open on startup</span>
          <select id="autoOpen">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label class="field">
          <span>Show day badge</span>
          <select id="showBadge">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
    </section>

    <section class="card">
      <h2>Add a link</h2>
      <div class="add-row">
        <input id="add-title" class="input" type="text" placeholder="Title" />
        <input id="add-url" class="input grow" type="text" placeholder="https://" />
        <button id="add-btn" class="btn">Add</button>
      </div>
      <div id="add-error" class="error" role="alert"></div>
    </section>

    <section class="card">
      <h2>Selected links</h2>
      <p class="hint">Drag the handle or use the arrows to set the order tabs open in. Toggle day pills to choose when each link opens.</p>
      <div id="links-list" class="links"></div>
      <div id="links-empty" class="empty">No links yet. Add one above or import from your bookmarks.</div>
    </section>

    <section class="card">
      <h2>Import from Chrome bookmarks</h2>
      <p class="hint">Check a bookmark to add it. Unchecking removes the imported copy.</p>
      <div id="bookmarks-tree" class="tree"></div>
    </section>
  </div>

  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `linkx/options.css`**

```css
:root {
  --bg: #0b0f14;
  --card: #121821;
  --card-2: #0e141c;
  --text: #e6edf3;
  --muted: #8b98a5;
  --border: #1e2733;
  --brand: #16a34a;
  --brand-dim: #12331f;
  --danger: #ef4444;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

.wrap { max-width: 920px; margin: 0 auto; padding: 32px 20px 64px; }

.head h1 { margin: 0 0 4px; font-size: 22px; }
.head .sub { margin: 0 0 8px; color: var(--muted); }

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  margin-top: 18px;
}
.card h2 { margin: 0 0 14px; font-size: 15px; }
.hint { margin: -6px 0 14px; color: var(--muted); font-size: 12px; }

.settings-grid { display: flex; gap: 18px; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field span { color: var(--muted); font-size: 12px; }

select, .input {
  background: var(--card-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
}
select { min-width: 150px; }
.input.grow { flex: 1; }

.add-row { display: flex; gap: 10px; align-items: center; }

.btn {
  background: var(--brand);
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 9px 16px;
  font: inherit;
  cursor: pointer;
}
.btn:hover { filter: brightness(1.08); }

.error { color: var(--danger); font-size: 12px; min-height: 16px; margin-top: 8px; }

.empty { color: var(--muted); font-size: 13px; padding: 8px 0; }

.links { display: flex; flex-direction: column; }

.link-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.link-row:first-child { border-top: 0; }

.handle { cursor: grab; color: var(--muted); user-select: none; padding: 0 2px; }
.arrows { display: flex; flex-direction: column; line-height: 1; }
.arrows button {
  background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 11px; padding: 0;
}
.arrows button:hover { color: var(--text); }

.title-input {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  font: inherit;
  border-radius: 6px;
  padding: 5px 6px;
  width: 200px;
}
.title-input:hover, .title-input:focus { border-color: var(--border); outline: none; }

.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  background: var(--card-2);
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.pill.on { background: var(--brand); border-color: var(--brand); color: #fff; }

.shortcuts { display: flex; gap: 10px; margin-left: auto; }
.shortcut { background: none; border: 0; color: var(--muted); font-size: 12px; cursor: pointer; }
.shortcut:hover { color: var(--text); }

.del { background: none; border: 0; color: var(--muted); font-size: 16px; cursor: pointer; }
.del:hover { color: var(--danger); }

.link-row.drag-over { border-top: 2px solid var(--brand); }

.tree { display: flex; flex-direction: column; gap: 2px; }
.tree details { margin-left: 6px; }
.tree summary { cursor: pointer; color: var(--text); padding: 3px 0; }
.bm-item { display: flex; align-items: center; gap: 8px; margin-left: 20px; padding: 2px 0; color: var(--muted); }
.bm-item input { accent-color: var(--brand); }
```

- [ ] **Step 3: Manually verify layout**

1. Reload Linkx at `chrome://extensions`, click **Details → Extension options** (or right-click the icon → Options).
2. Expected: a dark page titled **Linkx** with four cards (Settings, Add a link, Selected links, Import from Chrome bookmarks). Controls are visible; the links list shows the "No links yet" message. No script wired yet, so nothing is interactive.

- [ ] **Step 4: Commit**

```bash
git add linkx/options.html linkx/options.css
git commit -m "feat: add options page shell and dark theme"
```

---

### Task 6: Options logic — settings, add link, list, day pills, reorder, delete (`options.js`)

**Files:**
- Create: `linkx/options.js`

**Interfaces:**
- Consumes: `getConfig`, `setConfig` from `lib/storage.js`; `DAYS`, `normalizeUrl`, `emptyDays`, `everydayDays`, `weekdayDays`, `weekendDays` from `lib/logic.js`; the DOM IDs from Task 5.
- Produces (internal functions Task 7 will call): a module-level `config` object `{ settings, links }`; `save()`; `renderLinks()`; `reindex()`; `addLinkFromBookmark(title, url)`; `removeLinkByUrl(url)`. `crypto.randomUUID()` is used for link ids.

- [ ] **Step 1: Create `linkx/options.js`**

```js
import { getConfig, setConfig } from './lib/storage.js';
import {
  DAYS, normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays,
} from './lib/logic.js';

let config = { settings: {}, links: [] };
let dragFrom = null;

const $ = (id) => document.getElementById(id);

async function save() {
  await setConfig(config);
}

function reindex() {
  config.links.forEach((l, i) => { l.order = i; });
}

// ---- Settings ----

function renderSettings() {
  $('openIn').value = config.settings.openIn;
  $('autoOpen').value = config.settings.autoOpenOnStartup ? 'yes' : 'no';
  $('showBadge').value = config.settings.showDayBadge ? 'yes' : 'no';
}

function wireSettings() {
  $('openIn').addEventListener('change', (e) => {
    config.settings.openIn = e.target.value; save();
  });
  $('autoOpen').addEventListener('change', (e) => {
    config.settings.autoOpenOnStartup = e.target.value === 'yes'; save();
  });
  $('showBadge').addEventListener('change', (e) => {
    config.settings.showDayBadge = e.target.value === 'yes'; save();
  });
}

// ---- Add link ----

function wireAdd() {
  $('add-btn').addEventListener('click', onAdd);
  $('add-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') onAdd(); });
}

function onAdd() {
  const title = $('add-title').value.trim();
  const url = normalizeUrl($('add-url').value);
  if (!url) {
    $('add-error').textContent = 'Enter a valid URL.';
    return;
  }
  $('add-error').textContent = '';
  config.links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: config.links.length,
  });
  reindex();
  save();
  renderLinks();
  $('add-title').value = '';
  $('add-url').value = '';
}

// ---- Links list ----

function renderLinks() {
  const list = $('links-list');
  list.innerHTML = '';
  $('links-empty').style.display = config.links.length ? 'none' : 'block';

  config.links.forEach((link, index) => {
    list.appendChild(renderRow(link, index));
  });
}

function renderRow(link, index) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.dataset.index = String(index);

  // Handle (drag source)
  const handle = document.createElement('span');
  handle.className = 'handle';
  handle.textContent = '⠿';
  handle.draggable = true;
  handle.addEventListener('dragstart', () => { dragFrom = index; });
  row.appendChild(handle);

  // Up/down arrows
  const arrows = document.createElement('div');
  arrows.className = 'arrows';
  const up = document.createElement('button');
  up.textContent = '▲';
  up.title = 'Move up';
  up.addEventListener('click', () => moveLink(index, index - 1));
  const down = document.createElement('button');
  down.textContent = '▼';
  down.title = 'Move down';
  down.addEventListener('click', () => moveLink(index, index + 1));
  arrows.append(up, down);
  row.appendChild(arrows);

  // Title (editable input)
  const title = document.createElement('input');
  title.className = 'title-input';
  title.type = 'text';
  title.value = link.title;
  title.addEventListener('change', () => { link.title = title.value.trim() || link.url; save(); });
  row.appendChild(title);

  // Day pills
  const pills = document.createElement('div');
  pills.className = 'pills';
  DAYS.forEach((label, dayIdx) => {
    const pill = document.createElement('button');
    pill.className = 'pill' + (link.days[dayIdx] ? ' on' : '');
    pill.textContent = label;
    pill.addEventListener('click', () => {
      link.days = link.days.slice();
      link.days[dayIdx] = !link.days[dayIdx];
      save();
      renderLinks();
    });
    pills.appendChild(pill);
  });
  row.appendChild(pills);

  // Quick shortcuts
  const shortcuts = document.createElement('div');
  shortcuts.className = 'shortcuts';
  const addShortcut = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'shortcut';
    b.textContent = label;
    b.addEventListener('click', () => { link.days = fn(); save(); renderLinks(); });
    shortcuts.appendChild(b);
  };
  addShortcut('Everyday', everydayDays);
  addShortcut('Weekdays', weekdayDays);
  addShortcut('Weekends', weekendDays);
  addShortcut('Clear', emptyDays);
  row.appendChild(shortcuts);

  // Delete
  const del = document.createElement('button');
  del.className = 'del';
  del.textContent = '✕';
  del.title = 'Remove link';
  del.addEventListener('click', () => {
    config.links = config.links.filter((l) => l.id !== link.id);
    reindex();
    save();
    renderLinks();
  });
  row.appendChild(del);

  // Drop target behavior
  row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.classList.remove('drag-over');
    if (dragFrom !== null && dragFrom !== index) moveLink(dragFrom, index);
    dragFrom = null;
  });

  return row;
}

function moveLink(from, to) {
  if (to < 0 || to >= config.links.length) return;
  const [item] = config.links.splice(from, 1);
  config.links.splice(to, 0, item);
  reindex();
  save();
  renderLinks();
}

// ---- Bookmark helpers (used by Task 7) ----

function addLinkFromBookmark(title, url) {
  config.links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: config.links.length,
  });
  reindex();
  save();
  renderLinks();
}

function removeLinkByUrl(url) {
  config.links = config.links.filter((l) => l.url !== url);
  reindex();
  save();
  renderLinks();
}

// ---- Init ----

async function init() {
  config = await getConfig();
  config.links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  reindex();
  renderSettings();
  wireSettings();
  wireAdd();
  renderLinks();
}

init();

export { config, save, reindex, renderLinks, addLinkFromBookmark, removeLinkByUrl };
```

- [ ] **Step 2: Syntax check**

Run: `cd linkx && node --check options.js`
Expected: no output (exit 0).

- [ ] **Step 3: Manually verify in Chrome**

1. Reload Linkx, open its Options page.
2. Add a manual link (`Title` + `example.com`) → row appears; try an empty/invalid URL → "Enter a valid URL." shows, nothing added.
3. Toggle day pills; click **Weekdays**, **Weekends**, **Everyday**, **Clear** → pills update.
4. Add a second link; use arrows and drag the handle to reorder.
5. Set a link's pills to include **today**, then click the toolbar icon → today's link(s) open per the "Open links in" setting. Switch to **New Window** and repeat.
6. Toggle **Show day badge** off/on → badge clears/reappears.
7. Reload the Options page → all changes persisted.

- [ ] **Step 4: Commit**

```bash
git add linkx/options.js
git commit -m "feat: add options logic for links, days, reorder, and settings"
```

---

### Task 7: Bookmark import tree (`options.js`)

**Files:**
- Modify: `linkx/options.js` (add bookmark-tree rendering and wire it into `init`)

**Interfaces:**
- Consumes: `chrome.bookmarks.getTree`; existing `config`, `addLinkFromBookmark`, `removeLinkByUrl`, `renderLinks` from Task 6; `#bookmarks-tree` from Task 5.
- Produces: an expandable bookmark tree whose checkboxes add/remove links. Also re-checks the tree state after list changes.

- [ ] **Step 1: Add bookmark functions to `linkx/options.js`** — insert these functions just above the `// ---- Init ----` comment

```js
// ---- Bookmark import ----

function renderBookmarkNode(node) {
  if (node.url) {
    const label = document.createElement('label');
    label.className = 'bm-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = config.links.some((l) => l.url === node.url);
    cb.addEventListener('change', () => {
      if (cb.checked) addLinkFromBookmark(node.title, node.url);
      else removeLinkByUrl(node.url);
    });
    label.append(cb, document.createTextNode(' ' + (node.title || node.url)));
    return label;
  }
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = node.title || '(folder)';
  details.appendChild(summary);
  for (const child of node.children || []) {
    details.appendChild(renderBookmarkNode(child));
  }
  return details;
}

async function renderBookmarks() {
  const container = $('bookmarks-tree');
  container.innerHTML = '';
  const tree = await chrome.bookmarks.getTree();
  const roots = (tree[0] && tree[0].children) || [];
  for (const root of roots) {
    container.appendChild(renderBookmarkNode(root));
  }
}
```

- [ ] **Step 2: Call `renderBookmarks()` from `init`** — in `options.js`, change the end of the `init` function.

Replace:
```js
  wireAdd();
  renderLinks();
}
```
With:
```js
  wireAdd();
  renderLinks();
  renderBookmarks();
}
```

- [ ] **Step 3: Re-sync tree checkboxes after list edits** — so deleting a link in the list un-checks it in the tree. In `options.js`, update `renderLinks` to refresh the tree checkboxes without collapsing folders.

Replace the whole `renderLinks` function with:
```js
function renderLinks() {
  const list = $('links-list');
  list.innerHTML = '';
  $('links-empty').style.display = config.links.length ? 'none' : 'block';

  config.links.forEach((link, index) => {
    list.appendChild(renderRow(link, index));
  });

  syncBookmarkChecks();
}

function syncBookmarkChecks() {
  const urls = new Set(config.links.map((l) => l.url));
  document.querySelectorAll('#bookmarks-tree input[type="checkbox"]').forEach((cb) => {
    cb.checked = urls.has(cb.dataset.url);
  });
}
```

- [ ] **Step 4: Tag each checkbox with its URL** — in `renderBookmarkNode`, so `syncBookmarkChecks` can match. Replace:
```js
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = config.links.some((l) => l.url === node.url);
```
With:
```js
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.url = node.url;
    cb.checked = config.links.some((l) => l.url === node.url);
```

- [ ] **Step 5: Syntax check**

Run: `cd linkx && node --check options.js`
Expected: no output (exit 0).

- [ ] **Step 6: Manually verify in Chrome**

1. Reload Linkx, open Options.
2. The **Import from Chrome bookmarks** card shows your bookmark folders (expandable). Check a bookmark → it appears in **Selected links**.
3. Uncheck it → it disappears from the list.
4. Check a bookmark to add it, then delete it via the list's `✕` → its tree checkbox unchecks (expanded folders stay open).
5. Assign it to today, click the toolbar icon → it opens.

- [ ] **Step 7: Commit**

```bash
git add linkx/options.js
git commit -m "feat: add Chrome bookmark import with two-way checkbox sync"
```

---

## Final Verification

- [ ] Run the unit suite: `cd linkx && node --test` → all tests pass.
- [ ] Syntax-check all modules: `cd linkx && node --check background.js && node --check options.js && node --check lib/storage.js && node --check lib/logic.js`.
- [ ] Full manual pass in Chrome: import + manual add, day pills + shortcuts, reorder (drag + arrows), delete, click-to-open (new tab AND new window), day badge on/off, and restart-Chrome auto-open (enable the setting, fully quit and reopen Chrome).
- [ ] Confirm no console errors in the service worker or the options page.

## Notes for the implementer

- **Git:** the working folder isn't a git repo yet. Before Task 1, if the user wants version history, run `git init` at the repo root. Otherwise the `git commit` steps can be skipped — flag this to the user rather than silently skipping.
- **Restart-based tests** (`onStartup`, auto-open) require fully quitting Chrome (not just closing a window). Note that `onStartup` does not fire on extension reload.
- **Known minor limitation:** the bookmark tree renders top-level roots (Bookmarks Bar, Other, Mobile) as expandable folders; very large bookmark trees render fully (no virtualization) — acceptable for a personal tool.
