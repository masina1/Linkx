# Linkx — Profiles Design

**Date:** 2026-08-02
**Status:** Approved (brainstorming)
**Applies to:** Linkx MV3 extension (currently v1.0.3, live on Chrome Web Store)

## Goal

Let a user keep multiple independent sets of links ("profiles") — e.g. a
green **Default**, an orange **Work**, a blue **Personal** — and switch between
them seamlessly. The active profile is shown by the toolbar icon's color and
persists across browser restarts (and syncs across machines). Switching is done
by right-clicking the toolbar icon; no left-click behavior changes.

Non-goals: importing/exporting profiles, sharing profiles between users,
per-profile keyboard shortcuts.

## Constraints & context

- MV3 service worker. The toolbar icon has **no popup** — `chrome.action.onClicked`
  opens today's links directly (`background.js`). This must stay true.
- The icon is drawn procedurally (green disc + white ring) in `tools/make-icons.js`
  — so it can be recolored at runtime.
- Config lives in `chrome.storage.sync` with a `chrome.storage.local` fallback
  (`lib/storage.js`). Pure logic lives in `lib/logic.js` and is unit-tested
  (`test/logic.test.js`).
- There are **live users on v1.0.3**, so migration must be lossless.

## Data model (v2)

Current shape (v1):

```js
{ settings, links }
```

New shape (v2):

```js
{
  version: 2,
  activeProfileId: "<id>",
  profiles: [
    {
      id: "<uuid>",
      name: "Default",
      color: "#16a34a",
      settings: { openIn, autoOpenOnStartup, showDayBadge },
      links: [ { id, title, url, days[7], order }, ... ]
    },
    // ... up to 4 profiles total
  ]
}
```

- **Max 4 profiles** total (Default + up to 3).
- Each profile owns its **own** `settings` and `links` (fully independent
  workspaces). Switching a profile can therefore also change badge/auto-open
  behavior.
- Default profile is named `"Default"` (renameable) and colored green
  (`#16a34a`, the current brand color).

### Migration (critical — lossless for live users)

`withDefaults(stored)` in `logic.js` detects shape and normalizes:

- If `stored` has `profiles` (v2): validate/fill defaults, clamp to 4, ensure
  `activeProfileId` points at an existing profile (else first profile).
- If `stored` is the v1 `{ settings, links }` (no `profiles`): wrap it into a
  single `"Default"` green profile, set it active, stamp `version: 2`. **No data
  is lost** — existing links become the Default profile.
- If `stored` is empty/undefined: create one empty green `"Default"` profile.

`getConfig()`/`setConfig()` keep their sync→local fallback; they always read/write
the v2 shape (migration happens on read via `withDefaults`).

## Palette

A curated constant in `logic.js`, ~20 legible, distinct swatches (e.g. green,
emerald, teal, cyan, blue, indigo, violet, purple, fuchsia, pink, rose, red,
orange, amber, yellow, lime, slate, etc.). Default green `#16a34a` is included.
A profile's color is chosen from these swatches only (no free hue-wheel) —
prevents illegible/ugly icons. Duplicate colors are allowed but the palette
makes distinct choices easy.

## Switching — right-click the toolbar icon (Phase 1)

- Add `"contextMenus"` permission to the manifest.
- Build a menu with `contexts: ['action']`:
  - One **radio** item per profile, `title = profile.name`, `checked = (id === activeProfileId)`.
  - A separator, then **"Manage profiles…"** which opens the options page.
- On click of a profile item: set `activeProfileId`, save, then refresh icon +
  badge + menu checkmarks.
- **Left-click unchanged** — still opens today's links instantly, from the active profile.
- Menu is (re)built on install, on startup, and whenever profiles/active change
  (via `chrome.storage.onChanged`).

## Icon + badge color (Phase 1)

Both change to reflect the active profile ("Both" was chosen).

- Port `drawIcon(size, color)` logic into the service worker using
  `OffscreenCanvas` (disc in profile color + white ring), producing `ImageData`
  at sizes 16/32/48/128, then `chrome.action.setIcon({ imageData })`.
- Set `chrome.action.setBadgeBackgroundColor` to the profile color. Badge text
  remains the day abbreviation, gated by the active profile's `showDayBadge`.
- **Fallback:** if `OffscreenCanvas`/`setIcon` throws, silently keep the static
  PNG icon and rely on badge color only. Switching must never break.

## Options page — managing profiles (Phase 1)

- A **row of colored chips** at the top: each profile as a color dot + name,
  plus a **"+ Add"** button (disabled when 4 profiles exist).
- Clicking a chip selects that profile **for editing**. The existing
  add-link / links-list / settings UI below is scoped to the selected profile.
  **Editing selection is independent of the active profile** (edit Work while
  Personal is active).
- The active profile's chip shows an **"● active"** marker; each chip offers a
  **"Make active"** action.
- Per profile controls:
  - **Rename** (text input).
  - **Color** — the 20-swatch palette; click a swatch to set the profile color.
  - **Delete** — blocked when only one profile remains; deleting the active
    profile reassigns active to a neighboring profile.
- Adding a profile creates an empty profile with a default (next available)
  palette color and a placeholder name (e.g. "Profile 2"), selected for editing.

## Page context menu (Phase 2)

Right-click **any webpage** → a **"Linkx"** submenu (`contexts: ['page']`):

- **Add this page → (no days)** — add the current tab to the **active** profile
  with `emptyDays()`.
- **Add this page → Everyday** — add with `everydayDays()` so it opens starting today.
- separator
- **Switch profile ▸** — the same radio list of profiles, so the user can switch
  from the page too.

Details:

- "Add this page" always targets the **active** profile (matches the icon color).
- URL normalized via existing `normalizeUrl()`; title from the tab / `info`.
- **Dedup by normalized URL:** if the page is already in the active profile, do
  not add a duplicate. The **Everyday** variant flips the existing entry's days
  to everyday; the **no-days** variant is a no-op if already present.
- No new permission needed — `contextMenus` (Phase 1) covers page menus; reading
  the active tab uses the existing `tabs` permission via the click event.
- (`'link'` context to add a hovered link is a possible later addition — out of scope.)

## Testing

Keep DOM/Chrome-API code thin; put logic in `logic.js` and unit-test in
`test/logic.test.js` (`node --test`):

- `withDefaults` migration: v1 → v2 wrap (lossless), v2 passthrough/validation,
  empty → single default, clamp to 4, active-id repair.
- Profile helpers: `addProfile` (respects max 4, assigns color/name),
  `renameProfile`, `deleteProfile` (can't delete last; reassign active),
  `setActiveProfile`.
- Palette constant present and includes the default green.
- Phase 2: dedup/add-current-page logic (pure part: given links + url + variant →
  new links array).

## Versioning

Per project rule, bump the version in **both** `manifest.json` and
`package.json` on each change. This introduces a new permission (`contextMenus`)
and a real feature, so it's a meaningful **minor** bump (e.g. 1.0.3 → 1.1.0 for
Phase 1). Phase 2 is a further bump.

## Phasing

- **Phase 1** — profiles core: data model + migration, right-click **icon** menu
  switch, icon+badge recolor, options-page profile management, palette. (First
  implementation plan.)
- **Phase 2** — page right-click **"Linkx"** submenu (add current page ×2
  variants + switch profile).

One spec covers both; implement Phase 1 first, then Phase 2. They share the
menu-building code, so the design stays coherent.
