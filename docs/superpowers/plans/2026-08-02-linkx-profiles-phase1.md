# Linkx Profiles — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Linkx user keep up to 4 independent profiles (each with its own name, palette color, settings, and links) and switch the active one by right-clicking the toolbar icon, with the active profile's color shown on both the icon and the badge.

**Architecture:** Config in `chrome.storage.sync` migrates from the v1 `{settings, links}` shape to a v2 `{version, activeProfileId, profiles[]}` shape (lossless — existing links become a green "Default" profile). All state transitions and icon-pixel math live as pure functions in `lib/logic.js` and `lib/icon.js` (unit-tested with `node --test`). The service worker builds a `contexts:['action']` context menu for switching, recolors the icon via `OffscreenCanvas`+`setIcon`, and reads the active profile for opening links. The options page gains a profile chip bar; the existing links/settings UI is scoped to the profile currently selected for editing.

**Tech Stack:** Manifest V3, vanilla ES modules, `node --test` (no deps), `chrome.contextMenus`, `chrome.action.setIcon`, `OffscreenCanvas`/`ImageData`.

## Global Constraints

- Manifest V3; service worker is `type: module`.
- **Left-click behavior is unchanged** — clicking the icon still opens today's links instantly (from the active profile). No popup.
- **Max 4 profiles** total.
- Default profile is named `Default`, colored green `#16a34a` (the current brand color).
- **Migration must be lossless** for live v1.0.3 users — existing `{settings, links}` becomes the single Default profile.
- Bump the version in **both** `linkx/manifest.json` and `linkx/package.json` on this feature (1.0.3 → **1.1.0**).
- **No Claude co-author trailer** in any commit in this repo.
- Pure logic goes in `lib/logic.js` / `lib/icon.js` and is unit-tested; Chrome-API/DOM code (`background.js`, `options.js`) is verified manually in-browser (repo convention — see the note atop `lib/storage.js`).

## File Structure

- `linkx/lib/logic.js` — **Modify.** Add palette + profile constants, v2 migration in `withDefaults`, and pure profile mutation helpers.
- `linkx/lib/icon.js` — **Create.** Pure `hexToRgb` + `drawIconRGBA` (testable) and a browser-only `iconImageData` wrapper.
- `linkx/test/logic.test.js` — **Modify.** Rewrite the two `withDefaults` assertions for the v2 shape; add migration + helper tests.
- `linkx/test/icon.test.js` — **Create.** Tests for `hexToRgb` and `drawIconRGBA`.
- `linkx/background.js` — **Modify.** Active-profile-aware open/badge, icon+badge recolor, context menu build + click handling, refresh on storage change.
- `linkx/manifest.json` — **Modify.** Add `contextMenus` permission; bump version.
- `linkx/package.json` — **Modify.** Bump version.
- `linkx/options.html` — **Modify.** Add the profiles bar section.
- `linkx/options.css` — **Modify.** Chip + swatch styles.
- `linkx/options.js` — **Modify.** Scope existing UI to the "editing" profile; render the chip bar and per-profile controls.

---

### Task 1: v2 data model + lossless migration (logic.js)

**Files:**
- Modify: `linkx/lib/logic.js`
- Test: `linkx/test/logic.test.js`

**Interfaces:**
- Consumes: existing `DEFAULT_SETTINGS`.
- Produces:
  - `MAX_PROFILES = 4`, `CONFIG_VERSION = 2`, `DEFAULT_PROFILE_COLOR = '#16a34a'`, `PALETTE` (array of 20 hex strings, `PALETTE[0] === DEFAULT_PROFILE_COLOR`).
  - `makeProfile(overrides = {}) -> { id, name, color, settings, links }`
  - `withDefaults(stored) -> { version, activeProfileId, profiles }` (v2 shape now).

- [ ] **Step 1: Write failing tests** (append to `linkx/test/logic.test.js`, and update the import line to add the new names)

```js
// add to the existing import from '../lib/logic.js':
//   MAX_PROFILES, CONFIG_VERSION, DEFAULT_PROFILE_COLOR, PALETTE, makeProfile

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd linkx && node --test`
Expected: FAIL — `PALETTE`/`makeProfile`/`CONFIG_VERSION` not exported; `withDefaults` still returns the v1 shape.

- [ ] **Step 3: Implement in `linkx/lib/logic.js`**

Add near the top (after `DEFAULT_SETTINGS`):

```js
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
```

Then **replace** the existing `withDefaults` (currently at the bottom of the file) with:

```js
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
```

- [ ] **Step 4: Fix the two now-broken legacy assertions**

The existing test `withDefaults fills settings and coerces links` (currently `logic.test.js:61-67`) asserts the old v1 shape and will fail. **Replace that whole `test(...)` block** with:

```js
test('withDefaults wraps legacy settings/links into the Default profile', () => {
  const merged = withDefaults({ settings: { openIn: 'newWindow' }, links: [{ id: 'x' }] });
  const p = merged.profiles[0];
  assert.equal(p.settings.openIn, 'newWindow');
  assert.equal(p.settings.showDayBadge, true); // from defaults
  assert.equal(p.links.length, 1);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd linkx && node --test`
Expected: PASS (all tests, including the rewritten legacy one).

- [ ] **Step 6: Commit**

```bash
git add linkx/lib/logic.js linkx/test/logic.test.js
git commit -m "feat: add v2 profiles data model with lossless migration"
```

---

### Task 2: pure profile mutation helpers (logic.js)

**Files:**
- Modify: `linkx/lib/logic.js`
- Test: `linkx/test/logic.test.js`

**Interfaces:**
- Consumes: `makeProfile`, `PALETTE`, `MAX_PROFILES` (Task 1).
- Produces (all pure; return a **new** config object, never mutate the input):
  - `getActiveProfile(config) -> profile`
  - `nextUnusedColor(config) -> hex`
  - `addProfile(config, overrides = {}) -> config` (no-op if already at `MAX_PROFILES`; new profile is appended last)
  - `renameProfile(config, id, name) -> config`
  - `setProfileColor(config, id, color) -> config`
  - `deleteProfile(config, id) -> config` (no-op if only one profile; if the active one is deleted, active moves to the first remaining)
  - `setActiveProfile(config, id) -> config` (no-op if `id` not present)

- [ ] **Step 1: Write failing tests** (append to `linkx/test/logic.test.js`; add the new names to the import)

```js
// add to import: getActiveProfile, nextUnusedColor, addProfile, renameProfile,
//                setProfileColor, deleteProfile, setActiveProfile

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
  c = addProfile(c); c = addProfile(c); // now 4
  assert.equal(c.profiles.length, 4);
  const capped = addProfile(c); // 5th refused
  assert.equal(capped.profiles.length, 4);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd linkx && node --test`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement in `linkx/lib/logic.js`** (append after `withDefaults`)

```js
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
    name: overrides.name || `Profile ${config.profiles.length + 1}`,
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
  const profiles = config.profiles.filter((p) => p.id !== id);
  const activeProfileId = config.activeProfileId === id ? profiles[0].id : config.activeProfileId;
  return { ...config, activeProfileId, profiles };
}

export function setActiveProfile(config, id) {
  if (!config.profiles.some((p) => p.id === id)) return config;
  return { ...config, activeProfileId: id };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd linkx && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add linkx/lib/logic.js linkx/test/logic.test.js
git commit -m "feat: add pure profile mutation helpers"
```

---

### Task 3: icon pixel rendering (icon.js)

**Files:**
- Create: `linkx/lib/icon.js`
- Test: `linkx/test/icon.test.js`

**Interfaces:**
- Produces:
  - `hexToRgb(hex) -> { r, g, b }`
  - `drawIconRGBA(size, color) -> Uint8ClampedArray` (length `size*size*4`; pure — no canvas)
  - `iconImageData(size, color) -> ImageData` (browser-only; wraps `drawIconRGBA`)

- [ ] **Step 1: Write failing tests** — create `linkx/test/icon.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, drawIconRGBA } from '../lib/icon.js';

test('hexToRgb parses 6-digit hex with or without hash', () => {
  assert.deepEqual(hexToRgb('#16a34a'), { r: 0x16, g: 0xa3, b: 0x4a });
  assert.deepEqual(hexToRgb('dc2626'), { r: 0xdc, g: 0x26, b: 0x26 });
});

test('drawIconRGBA has the right length and a colored, opaque center', () => {
  const size = 16;
  const rgba = drawIconRGBA(size, '#16a34a');
  assert.equal(rgba.length, size * size * 4);
  const c = Math.floor((size - 1) / 2);
  const i = (c * size + c) * 4;
  assert.deepEqual([rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]], [0x16, 0xa3, 0x4a, 255]);
});

test('drawIconRGBA leaves the corner fully transparent', () => {
  const size = 16;
  const rgba = drawIconRGBA(size, '#16a34a');
  assert.equal(rgba[3], 0); // top-left pixel alpha
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd linkx && node --test`
Expected: FAIL — `../lib/icon.js` does not exist.

- [ ] **Step 3: Implement** — create `linkx/lib/icon.js`

```js
// Icon pixel math ported from tools/make-icons.js, parameterized by color.
// drawIconRGBA is pure (Node + browser). iconImageData is browser-only.

export function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : 0x16a34a;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function drawIconRGBA(size, color) {
  const { r, g, b } = hexToRgb(color);
  const rgba = new Uint8ClampedArray(size * size * 4); // transparent
  const c = (size - 1) / 2;
  const R = size * 0.46;
  const ringOuter = size * 0.42;
  const ringInner = size * 0.30;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const i = (y * size + x) * 4;
      if (d <= R) {
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
      }
      if (d >= ringInner && d <= ringOuter) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

export function iconImageData(size, color) {
  return new ImageData(drawIconRGBA(size, color), size, size);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd linkx && node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add linkx/lib/icon.js linkx/test/icon.test.js
git commit -m "feat: add parameterized icon pixel renderer"
```

---

### Task 4: service worker — active-profile open/badge + recolor (background.js)

**Files:**
- Modify: `linkx/background.js`

**Interfaces:**
- Consumes: `getActiveProfile` (Task 2), `iconImageData` (Task 3), existing `linksForToday`, `todayIndex`, `dayAbbrev`.
- Produces (module-internal, used by Task 5): `applyVisuals(profile)`, `refreshAll(config)`.

This task is verified **manually in-browser** (repo convention — no automated tests for `background.js`).

- [ ] **Step 1: Rewrite the relevant parts of `linkx/background.js`**

Replace the imports and the `openToday`/`refreshBadge` section (top of file through the `refreshBadge` definition) with:

```js
import { getConfig, setConfig } from './lib/storage.js';
import { linksForToday, todayIndex, dayAbbrev, getActiveProfile, setActiveProfile } from './lib/logic.js';
import { iconImageData } from './lib/icon.js';

const DAILY_ALARM = 'linkx-daily-badge';
const ICON_SIZES = [16, 32, 48, 128];

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
  const config = await getConfig();
  const profile = getActiveProfile(config);
  const urls = linksForToday(profile.links, todayIndex()).map((l) => l.url);
  await openLinks(urls, profile.settings.openIn);
}

async function applyVisuals(profile) {
  try {
    const imageData = {};
    for (const s of ICON_SIZES) imageData[s] = iconImageData(s, profile.color);
    await chrome.action.setIcon({ imageData });
  } catch (e) {
    // Fallback: keep the static PNG icon; badge color below still conveys the profile.
  }
  await chrome.action.setBadgeBackgroundColor({ color: profile.color });
}

async function refreshBadge(config) {
  const cfg = config || (await getConfig());
  const profile = getActiveProfile(cfg);
  if (profile.settings.showDayBadge) {
    await chrome.action.setBadgeText({ text: dayAbbrev(todayIndex()) });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// Apply the full visual state for the active profile (icon color, badge color, badge text).
async function refreshAll(config) {
  const cfg = config || (await getConfig());
  const profile = getActiveProfile(cfg);
  await applyVisuals(profile);
  await refreshBadge(cfg);
}
```

Then update the lifecycle listeners at the bottom of the file so they call `refreshAll` instead of `refreshBadge` (leave the `openToday().catch` click handler and the alarm creation as-is except for the swap):

```js
chrome.action.onClicked.addListener(() => { openToday().catch(console.error); });

chrome.runtime.onInstalled.addListener(() => {
  refreshAll();
  chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshAll();
  const existing = await chrome.alarms.get(DAILY_ALARM);
  if (!existing) chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
  const config = await getConfig();
  if (getActiveProfile(config).settings.autoOpenOnStartup) await openToday();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) refreshBadge();
});

chrome.storage.onChanged.addListener(() => { refreshAll(); });
```

> Note: `setActiveProfile` is imported now but used in Task 5. Leaving the import in place here is intentional to avoid re-editing the import line.

- [ ] **Step 2: Load unpacked and verify (manual)**

1. `chrome://extensions` → Developer mode ON → **Load unpacked** → select the `linkx/` folder (or reload it if already loaded).
2. Confirm no service-worker errors (click "Service worker" → Console).
3. The toolbar icon should render **green** and the badge (e.g. `Wed`) should have a **green** background.
4. Left-click the icon → today's links open (unchanged behavior). If you have an existing v1.0.3 install with links, they should still be there (migrated into Default).

Expected: green icon + green badge, links open, no errors.

- [ ] **Step 3: Commit**

```bash
git add linkx/background.js
git commit -m "feat: drive icon and badge color from the active profile"
```

---

### Task 5: service worker — icon context menu to switch profiles (background.js + manifest)

**Files:**
- Modify: `linkx/background.js`
- Modify: `linkx/manifest.json`
- Modify: `linkx/package.json`

**Interfaces:**
- Consumes: `getConfig`, `setConfig`, `setActiveProfile`, `refreshAll`, `applyVisuals` (Task 4).
- Produces (module-internal): `buildMenu(config)`.

Verified **manually in-browser**.

- [ ] **Step 1: Add the `contextMenus` permission and bump the version in `linkx/manifest.json`**

Change the `permissions` array to include `"contextMenus"` and set `"version": "1.1.0"`:

```json
  "version": "1.1.0",
  "description": "Open your chosen bookmarks for today with one click.",
  "permissions": ["bookmarks", "storage", "tabs", "alarms", "contextMenus"],
```

- [ ] **Step 2: Bump the version in `linkx/package.json`**

```json
  "version": "1.1.0",
```

- [ ] **Step 3: Add menu building + click handling to `linkx/background.js`**

Add this `buildMenu` function next to `refreshAll` (menus use `contexts: ['action']` = the toolbar icon's right-click menu):

```js
async function buildMenu(config) {
  const cfg = config || (await getConfig());
  await chrome.contextMenus.removeAll();
  for (const p of cfg.profiles) {
    chrome.contextMenus.create({
      id: `profile:${p.id}`,
      title: p.name,
      type: 'radio',
      checked: p.id === cfg.activeProfileId,
      contexts: ['action'],
    });
  }
  chrome.contextMenus.create({ id: 'sep', type: 'separator', contexts: ['action'] });
  chrome.contextMenus.create({ id: 'manage', title: 'Manage profiles…', contexts: ['action'] });
}
```

Add a click handler (place it with the other top-level listeners):

```js
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'manage') { chrome.runtime.openOptionsPage(); return; }
  if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('profile:')) {
    const id = info.menuItemId.slice('profile:'.length);
    const config = await getConfig();
    const next = setActiveProfile(config, id);
    await setConfig(next);
    await refreshAll(next);
  }
});
```

Finally, make sure the menu is (re)built alongside visuals. Update the three refresh call sites to build the menu too — change `onInstalled`, `onStartup`, and `storage.onChanged` so each also calls `buildMenu`:

```js
chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  await refreshAll(config);
  await buildMenu(config);
  chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
});
```

```js
chrome.storage.onChanged.addListener(async () => {
  const config = await getConfig();
  await refreshAll(config);
  await buildMenu(config);
});
```

And in `onStartup`, after `await refreshAll();` add `await buildMenu();`.

- [ ] **Step 4: Load unpacked and verify (manual)**

1. Reload the extension at `chrome://extensions`.
2. **Right-click** the toolbar icon → you should see one radio item per profile (initially just **Default**, checked), a separator, and **Manage profiles…**.
3. Click **Manage profiles…** → the options page opens.
4. (Full switching is exercised once Task 7 lets you create a second profile — but you can pre-seed one to test now: open the SW console and run
   `chrome.storage.sync.get('linkxConfig', console.log)` to inspect, or just proceed to the options tasks.)

Expected: right-click menu shows Default + Manage profiles…; no errors.

- [ ] **Step 5: Commit**

```bash
git add linkx/background.js linkx/manifest.json linkx/package.json
git commit -m "feat: switch active profile from the toolbar icon context menu"
```

---

### Task 6: options page — scope existing UI to the editing profile (options.js/html/css)

**Files:**
- Modify: `linkx/options.js`
- Modify: `linkx/options.html`
- Modify: `linkx/options.css`

**Interfaces:**
- Consumes: `getConfig`/`setConfig`, `getActiveProfile` (logic).
- Produces (module-internal): `editingProfileId` state, `cp()` current-editing-profile accessor.

Verified **manually in-browser**. This task makes the page operate on a single selected profile without yet adding the chip UI — after it, the page edits the **active** profile by default and everything still works.

- [ ] **Step 1: Add the profiles bar container to `linkx/options.html`**

Immediately after the opening `<div class="wrap">` … `</header>` block and **before** the Settings `<section class="card">`, insert:

```html
    <section class="card">
      <h2>Profiles</h2>
      <p class="hint">Each profile has its own links and settings. Right-click the toolbar icon to switch which one is active.</p>
      <div id="profiles-bar" class="profiles-bar"></div>
    </section>
```

- [ ] **Step 2: Add profile state + accessor and scope all data access in `linkx/options.js`**

At the top, after `let config = ...`, add:

```js
let editingProfileId = null;

// The profile currently open for editing (falls back to the active one).
function cp() {
  return config.profiles.find((p) => p.id === editingProfileId) || getActiveProfile(config);
}
```

Update the import to pull in `getActiveProfile`:

```js
import {
  DAYS, normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays, getActiveProfile,
} from './lib/logic.js';
```

Now replace every `config.settings` with `cp().settings` and every `config.links` with `cp().links`. Concretely:

- `reindex()`:

```js
function reindex() {
  cp().links.forEach((l, i) => { l.order = i; });
}
```

- `renderSettings()`:

```js
function renderSettings() {
  $('openIn').value = cp().settings.openIn;
  $('autoOpen').value = cp().settings.autoOpenOnStartup ? 'yes' : 'no';
  $('showBadge').value = cp().settings.showDayBadge ? 'yes' : 'no';
}
```

- `wireSettings()` — set fields on `cp().settings`:

```js
function wireSettings() {
  $('openIn').addEventListener('change', (e) => { cp().settings.openIn = e.target.value; save(); });
  $('autoOpen').addEventListener('change', (e) => { cp().settings.autoOpenOnStartup = e.target.value === 'yes'; save(); });
  $('showBadge').addEventListener('change', (e) => { cp().settings.showDayBadge = e.target.value === 'yes'; save(); });
}
```

- `onAdd()` — change `config.links.push(...)` to `cp().links.push(...)` and `order: config.links.length` to `order: cp().links.length`.
- `renderLinks()` — change `config.links.length` (both uses) and `config.links.forEach` to `cp().links...`.
- `syncBookmarkChecks()` — `config.links.map` → `cp().links.map`.
- `renderRow()` delete handler — `config.links = config.links.filter(...)` → `cp().links = cp().links.filter(...)`.
- `moveLink()` — all `config.links` → `cp().links`.
- `addLinkFromBookmark()` / `removeLinkByUrl()` — all `config.links` → `cp().links`.
- `renderBookmarkNode()` — `config.links.some(...)` → `cp().links.some(...)`.

Update `init()` to set the editing profile and sort that profile's links:

```js
async function init() {
  config = await getConfig();
  editingProfileId = config.activeProfileId;
  cp().links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  reindex();
  renderSettings();
  wireSettings();
  wireAdd();
  renderLinks();
  renderBookmarks();
}
```

- [ ] **Step 3: Add minimal chip-bar CSS to `linkx/options.css`** (styling used fully in Task 7; add now so the container isn't unstyled)

```css
.profiles-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
```

- [ ] **Step 4: Load unpacked and verify (manual)**

1. Reload the extension, open the options page (right-click icon → Manage profiles…).
2. The Settings and Selected-links sections should behave exactly as before, now editing the **Default** (active) profile.
3. Add a link, toggle days, reorder, delete — all should persist (reopen the page to confirm).

Expected: no regressions; a new empty `#profiles-bar` sits above Settings.

- [ ] **Step 5: Commit**

```bash
git add linkx/options.js linkx/options.html linkx/options.css
git commit -m "refactor: scope options page to the selected profile"
```

---

### Task 7: options page — profile chips + rename/color/add/delete (options.js/css)

**Files:**
- Modify: `linkx/options.js`
- Modify: `linkx/options.css`

**Interfaces:**
- Consumes: `PALETTE`, `MAX_PROFILES`, `addProfile`, `renameProfile`, `setProfileColor`, `deleteProfile`, `setActiveProfile` (Task 2); `cp()`, `editingProfileId`, `save`, `renderSettings`, `renderLinks` (Task 6).

Verified **manually in-browser**. This is the last Phase 1 task and makes the full switch loop usable.

- [ ] **Step 1: Extend the import in `linkx/options.js`**

```js
import {
  DAYS, normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays,
  getActiveProfile, PALETTE, MAX_PROFILES,
  addProfile, renameProfile, setProfileColor, deleteProfile, setActiveProfile,
} from './lib/logic.js';
```

- [ ] **Step 2: Add rendering + wiring for the chip bar in `linkx/options.js`**

Add these functions (near `renderSettings`). `rerender()` refreshes everything that depends on the selected profile:

```js
function rerender() {
  renderProfiles();
  renderSettings();
  renderLinks();
}

function renderProfiles() {
  const bar = $('profiles-bar');
  bar.innerHTML = '';

  config.profiles.forEach((p) => {
    const chip = document.createElement('button');
    chip.className = 'profile-chip' + (p.id === editingProfileId ? ' editing' : '');
    chip.title = p.id === config.activeProfileId ? 'Active profile' : 'Click to edit';

    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = p.color;
    chip.appendChild(dot);

    const name = document.createElement('span');
    name.textContent = p.name;
    chip.appendChild(name);

    if (p.id === config.activeProfileId) {
      const active = document.createElement('span');
      active.className = 'chip-active';
      active.textContent = '● active';
      chip.appendChild(active);
    }

    chip.addEventListener('click', () => { editingProfileId = p.id; rerender(); });
    bar.appendChild(chip);
  });

  const add = document.createElement('button');
  add.className = 'btn add-profile';
  add.textContent = '+ Add';
  add.disabled = config.profiles.length >= MAX_PROFILES;
  add.addEventListener('click', () => {
    config = addProfile(config);
    editingProfileId = config.profiles[config.profiles.length - 1].id;
    save();
    rerender();
  });
  bar.appendChild(add);

  bar.appendChild(renderProfileEditor());
}

function renderProfileEditor() {
  const box = document.createElement('div');
  box.className = 'profile-editor';
  const p = cp();

  // Rename
  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.type = 'text';
  nameInput.value = p.name;
  nameInput.addEventListener('change', () => {
    config = renameProfile(config, p.id, nameInput.value.trim() || p.name);
    save();
    renderProfiles();
  });
  box.appendChild(nameInput);

  // Color palette
  const swatches = document.createElement('div');
  swatches.className = 'swatches';
  PALETTE.forEach((color) => {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (color === p.color ? ' on' : '');
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener('click', () => {
      config = setProfileColor(config, p.id, color);
      save();
      rerender();
    });
    swatches.appendChild(sw);
  });
  box.appendChild(swatches);

  // Make active
  if (p.id !== config.activeProfileId) {
    const makeActive = document.createElement('button');
    makeActive.className = 'shortcut';
    makeActive.textContent = 'Make active';
    makeActive.addEventListener('click', () => {
      config = setActiveProfile(config, p.id);
      save();
      renderProfiles();
    });
    box.appendChild(makeActive);
  }

  // Delete (blocked on the last profile)
  if (config.profiles.length > 1) {
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕ Delete profile';
    del.addEventListener('click', () => {
      config = deleteProfile(config, p.id);
      if (!config.profiles.some((x) => x.id === editingProfileId)) {
        editingProfileId = config.activeProfileId;
      }
      save();
      rerender();
    });
    box.appendChild(del);
  }

  return box;
}
```

- [ ] **Step 3: Call `renderProfiles()` from `init()`**

In `init()`, replace the standalone `renderSettings(); ... renderLinks();` sequence's start by calling `rerender()` once (keep `wireSettings()`/`wireAdd()`/`renderBookmarks()`):

```js
async function init() {
  config = await getConfig();
  editingProfileId = config.activeProfileId;
  cp().links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  reindex();
  wireSettings();
  wireAdd();
  rerender();          // renders profiles + settings + links
  renderBookmarks();
}
```

- [ ] **Step 4: Add chip/swatch/editor styles to `linkx/options.css`**

```css
.profile-chip {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--card-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 999px;
  padding: 6px 12px; cursor: pointer; font: inherit;
}
.profile-chip.editing { border-color: var(--brand); }
.chip-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.chip-active { color: var(--muted); font-size: 11px; }
.add-profile:disabled { opacity: 0.5; cursor: not-allowed; }

.profile-editor {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  width: 100%; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);
}
.swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.swatch {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer; padding: 0;
}
.swatch.on { border-color: var(--text); }
```

- [ ] **Step 5: Load unpacked and verify the full loop (manual)**

1. Reload the extension; open the options page.
2. Click **+ Add** → a second profile appears (e.g. "Profile 2") with the next palette color and opens for editing. Add a couple of links to it.
3. Pick a different **swatch** → the chip dot color updates; **rename** it → the chip label updates.
4. Right-click the toolbar icon → both profiles are listed; the active one is checked. Click the second → **icon + badge recolor** to its color, checkmark moves, and the choice sticks.
5. Left-click the icon → it now opens the **second** profile's today-links.
6. Close and reopen Chrome → the same profile is still active (persisted).
7. In options, select a profile and **✕ Delete profile** → it disappears; deleting the active one moves active to a remaining profile. The last remaining profile cannot be deleted (no delete button shown).
8. Confirm **+ Add** is disabled once 4 profiles exist.

Expected: full create → color → rename → switch → persist → delete loop works; left-click always opens the active profile's links.

- [ ] **Step 6: Commit**

```bash
git add linkx/options.js linkx/options.css
git commit -m "feat: manage profiles (add, rename, recolor, delete, activate) in options"
```

---

## Self-Review

**Spec coverage:**
- v2 model + lossless migration → Task 1. ✓
- Max 4 profiles, own settings+links → Tasks 1–2, enforced in `addProfile`. ✓
- Palette (~20 swatches, default green included) → Task 1 `PALETTE`; used in Task 7. ✓
- Right-click icon switch (radio + checkmark + Manage profiles…) → Task 5. ✓
- Icon + badge recolor with `OffscreenCanvas`/`ImageData` fallback → Tasks 3–4 (`iconImageData`, `applyVisuals` try/catch). ✓
- Persistence across restart / sync → storage.sync via existing `getConfig`/`setConfig`; verified in Task 7 step 5.6. ✓
- Options: chips, edit-independent-of-active, rename/color/delete/make-active, add capped at 4 → Tasks 6–7. ✓
- Version bump in manifest.json + package.json → Task 5. ✓
- Left-click unchanged → Task 4 keeps `onClicked -> openToday`. ✓
- **Phase 2 (page context menu)** is intentionally out of scope for this plan — it gets its own plan.

**Placeholder scan:** No TBD/TODO; every code step has concrete code. ✓

**Type consistency:** `withDefaults`/`makeProfile`/`getActiveProfile`/`addProfile`/`renameProfile`/`setProfileColor`/`deleteProfile`/`setActiveProfile` names match across Tasks 1, 2, 4, 5, 7. `iconImageData(size, color)` / `drawIconRGBA(size, color)` / `hexToRgb(hex)` match across Tasks 3–4. Menu id scheme `profile:<id>` produced and parsed in Task 5. `cp()` defined in Task 6, consumed in Task 7. ✓

**Note on `crypto`:** `genId()` (Task 1) uses `globalThis.crypto.randomUUID` when present and falls back to a `Math.random` id, so migration/tests don't depend on a specific Node version.
