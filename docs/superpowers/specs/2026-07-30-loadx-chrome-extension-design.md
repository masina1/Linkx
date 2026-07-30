# Linkx — Chrome Extension Design

**Date:** 2026-07-30
**Status:** Approved design, ready for implementation planning
**Repo:** https://github.com/masina1/Linkx

## Summary

Linkx is a Chrome extension (inspired by Loadr) that opens a chosen set of
saved links each day. You pick links — imported from your Chrome bookmarks or
added manually — assign each one to specific days of the week, and clicking the
toolbar icon opens all the links assigned to today in new tabs (or a new
window). It is a simple personal tool: no ads, no tracking, no network calls,
nothing leaves the machine.

## Goals

- Click the toolbar icon → open all links assigned to the current day.
- Configure links and behavior on an options page with a dark UI (like Loadr).
- Import links from existing Chrome bookmarks, and add links manually.
- Assign each link to any combination of days (Mon–Sun).
- Small quality-of-life features: reorder links, quick day shortcuts, a day
  badge on the icon, and optional auto-open when Chrome starts.

## Non-Goals (YAGNI)

- No popup window on icon click — clicking opens links directly.
- No accounts, sync services, analytics, ads, or telemetry.
- No host permissions or network requests.
- No notifications system.
- No "already opened today" de-duplication / suppression logic.

## Architecture

Manifest V3 extension. No build step — the folder loads directly into Chrome
via "Load unpacked".

```
linkx/
├── manifest.json          # MV3 config, permissions, action (icon click)
├── background.js          # Service worker: icon click, startup, badge, alarm
├── options.html           # Config/settings page
├── options.css            # Dark theme styling
├── options.js             # UI logic: render list, import bookmarks, drag, save
├── lib/
│   └── storage.js         # Shared module wrapping chrome.storage (get/set)
└── icons/                 # 16 / 48 / 128 px extension icons
```

**Permissions:** `bookmarks` (read bookmark tree for import), `storage` (save
config), `tabs` and `windows` (open links). No host permissions.

**Data flow:**
- `background.js` handles the toolbar icon click and `chrome.runtime.onStartup`.
  It reads config through `storage.js`, computes today's links, and opens them.
  It also maintains the day badge.
- `options.js` runs the options page, reading and writing the same config via
  `storage.js`.
- `lib/storage.js` is the single interface both sides use, so they always agree
  on the data shape and defaults.

## Data Model

Stored in `chrome.storage.sync` under a single object. If a sync write ever
fails (quota), fall back to `chrome.storage.local` and surface a message on the
options page.

```js
{
  settings: {
    openIn: "newTab" | "newWindow",   // where links open (default "newTab")
    autoOpenOnStartup: false,          // open today's links when Chrome starts
    showDayBadge: true                 // show current-day badge on icon
  },
  links: [
    {
      id: "uuid",                      // stable unique id
      title: "r/manga",
      url: "https://old.reddit.com/r/manga",
      days: [false,true,true,false,true,false,false],  // Mon..Sun, 7 booleans
      order: 0                         // ascending open order
    }
  ]
}
```

- **Day index:** array positions are Mon(0) … Sun(6).
- **Today's links:** `links` filtered where `days[todayIndex] === true`, sorted
  ascending by `order`.
- **Defaults on first run / corrupt storage:** `links: []`, and settings as
  noted above.

## Options Page UI

Dark theme matching Loadr's aesthetic. Four stacked card sections. All changes
save to storage immediately and update the view live — there is no separate
"Save" button.

### 1. Settings
- `Open links in` — dropdown: **New Tab** / **New Window**.
- `Auto-open on Chrome startup` — toggle: **Yes** / **No**.
- `Show day badge on icon` — toggle: **Yes** / **No**.

### 2. Add a link
- `Title` text field + `https://` URL field + **Add** button.
- URL is validated before adding; if no scheme is present, prepend `https://`.
- Invalid URL → inline error message, link not added.

### 3. Selected links
The main list. Each row contains:
- Drag handle + up/down arrows to reorder (updates `order`).
- Title (click to edit inline).
- Seven day pills: `Mon Tue Wed Thu Fri Sat Sun`, each toggles on/off;
  active days are visually highlighted.
- Quick shortcuts: `Everyday`, `Weekdays` (Mon–Fri), `Weekends` (Sat–Sun),
  `Clear`.
- `✕` button to delete the link.

Reordering uses the native HTML Drag & Drop API (no library).

### 4. Import from Chrome bookmarks
- Expandable tree of bookmark folders (from `chrome.bookmarks.getTree`).
- Each bookmark has a checkbox: checking adds a copy to `links`; unchecking
  removes that imported copy.
- Folders expand/collapse.
- Imported links store title + URL as a snapshot (not a live reference), so
  they keep working if the original bookmark is later deleted.

## Background Behavior (`background.js`)

- **Icon click** (`chrome.action.onClicked`): read config, select links where
  `days[today]` is true (sorted by `order`), and open them:
  - `newTab` → open each as a tab in the current window.
  - `newWindow` → open the first link in a new window, remaining links as tabs
    in that window.
  - If no links match today, do nothing (no empty tab, no error).
- **Day badge:** when `showDayBadge` is on, set the action badge text to the
  current day abbreviation (`Mon`…`Sun`). Refresh on startup and via a
  `chrome.alarms` daily tick so it stays correct across midnight. When off,
  clear the badge.
- **Startup auto-open** (`chrome.runtime.onStartup`): if `autoOpenOnStartup` is
  on, open today's links the same way an icon click would.
- **"Today"** uses the local system day-of-week.

## Edge Cases & Error Handling

- **Invalid URL (manual add):** block, show inline message; auto-prepend
  `https://` when scheme is missing.
- **No links match today:** clicking does nothing.
- **Large sets (20+ links):** open in small staggered batches to avoid choking
  Chrome; for new-window mode the first link creates the window and the rest
  become tabs in it.
- **Bookmark deleted after import:** the stored copy remains and still works.
- **Duplicate add:** permitted (permissive); no blocking.
- **storage.sync quota error:** fall back to `storage.local`, notify on options
  page.
- **Corrupt/empty storage on first run:** `storage.js` returns sensible
  defaults.

## Testing

No build step, so testing is manual plus a few pure-function unit checks.

- **Pure logic (unit-tested, runnable under Node, no framework required):**
  - `linksForToday(links, dayIndex)` — filtering + ordering.
  - URL validation / normalization.
  - Day-pill shortcut helpers (`everyday`, `weekdays`, `weekends`, `clear`).
- **Manual test checklist (load unpacked in Chrome):**
  1. Import a bookmark → appears in Selected links.
  2. Add a manual link with/without scheme; invalid URL rejected.
  3. Toggle day pills and quick shortcuts; state persists on reload.
  4. Reorder via drag and arrows; order persists.
  5. Click icon → only today's links open, in order.
  6. New-tab vs new-window setting behaves correctly.
  7. Day badge shows correct day; toggling the setting shows/clears it.
  8. Enable auto-open, restart Chrome → today's links open.

## Open Questions

None outstanding. Design approved by user on 2026-07-30.
