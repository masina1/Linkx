# Publishing Linkx to the Chrome Web Store

A step-by-step guide to getting Linkx live. Steps you must do yourself (account, payment, screenshots, final submit) are marked **[you]**; everything else is copy you can paste directly.

---

## 1. Prerequisites **[you]**

You already have a Chrome Web Store developer account (from your existing published app), so there's nothing to set up here — just sign in to the **[Developer Dashboard](https://chrome.google.com/webstore/devconsole)** with that same account.

_(For reference, a brand-new account would require a one-time US$5 registration fee — not applicable to you.)_

---

## 2. Package the extension (the ZIP)

The Web Store wants a ZIP whose **root** contains `manifest.json` — not a ZIP of the parent folder. Include only the files the extension actually needs; leave out dev-only files (`test/`, `tools/`, `package.json`).

Run the packaging script from the repo root in **PowerShell**:

```powershell
powershell -ExecutionPolicy Bypass -File tools\pack.ps1
```

This reads the version from `manifest.json` and writes `linkx-<version>.zip` (e.g. `linkx-1.0.3.zip`) containing exactly the shipping files, with `manifest.json`, `lib/`, and `icons/` at the root.

> **Why a script and not `Compress-Archive`?** Windows PowerShell 5.1's `Compress-Archive` (and `ZipFile.CreateFromDirectory`) write ZIP entry names with **backslashes** (`lib\logic.js`), but the ZIP spec requires forward slashes. Chrome would then treat the file as literally named `lib\logic.js` at the root, breaking the `import './lib/storage.js'` calls after install. `tools/pack.ps1` builds entries with explicit forward slashes to avoid this.

> Every store update needs a **higher version** than the last published one. We already bump `version` in `manifest.json` + `package.json` on each change, so just re-run the script.

To confirm the ZIP is correct, list its entries (paths should use `/`, and `manifest.json` should be at the top level):

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ver = (Get-Content linkx\manifest.json | ConvertFrom-Json).version
$z = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path "linkx-$ver.zip"))
$z.Entries.FullName; $z.Dispose()
```

---

## 3. Create the item & upload **[you]**

1. In the Developer Dashboard, click **Add new item**.
2. Upload `linkx-<version>.zip`.
3. Chrome parses the manifest and opens the listing editor.

---

## 4. Store listing (paste-ready copy)

**Name:** `Linkx`

**Summary** (≤ 132 characters):
```
Open the bookmarks you've chosen for today's weekday with a single click.
```

**Category:** `Productivity`

**Language:** English (or your preference)

**Description:**
```
Linkx opens the links you care about for the current day of the week — in one click.

Pick which bookmarks belong to Monday, Tuesday, ... Sunday (any combination), set the order they should open in, and choose whether they open in new tabs or a new window. Then just click the Linkx toolbar icon and today's links open.

FEATURES
• One-click open for the current weekday, in your chosen order
• Assign each link to any days, with Everyday / Weekdays / Weekends / Clear shortcuts
• Import directly from your existing Chrome bookmarks
• Open in new tabs or a new window
• Toolbar day badge shows the current weekday
• Optional auto-open when Chrome starts

PRIVACY
Linkx has no servers and makes no network requests. Your links and settings stay in your browser (synced through your own Google account if Chrome sync is on). Nothing is ever sent to the developer or any third party.

Linkx is free and open source, licensed under CC BY-NC 4.0.
```

**Graphic assets** (prepare these — **[you]**):
- **Store icon:** 128×128 PNG. Linkx already ships `icons/icon128.png`; you can reuse it.
- **Screenshots:** at least **1** (up to 5). **1280×800** or 640×400 PNG/JPEG. Load the extension, open its **Options** page with a few links configured and day pills toggled, and capture it. A second shot of the toolbar icon opening tabs is a nice-to-have.
- **Small promo tile** (optional): 440×280 PNG.

---

## 5. Privacy practices tab

**Single purpose** (paste):
```
Linkx opens the bookmarks the user has chosen for the current weekday when they click the toolbar icon.
```

**Permission justifications** (one per requested permission):

| Permission | Justification |
|---|---|
| `bookmarks` | Read the user's existing Chrome bookmarks to display them on the options page so the user can select which ones to add as daily links. Bookmarks are read only for display; they are never modified or transmitted. |
| `storage` | Save the user's link list and settings so they persist and sync across the user's own signed-in Chrome profiles. |
| `tabs` | Open the user's selected links in new tabs or a new window when they click the toolbar icon or on startup. |
| `alarms` | Refresh the toolbar day badge periodically so it always shows the correct current weekday. |

> **Reviewer note on `tabs`:** creating tabs (`chrome.tabs.create`) does **not** strictly require the `tabs` permission — that permission only grants access to sensitive tab properties (URL, title) which Linkx doesn't read. If a reviewer flags `tabs` as unnecessary, you can safely remove `"tabs"` from `manifest.json` and resubmit; the open-links feature will still work. It's currently declared for clarity.

**Data usage** — declare and certify:
- Linkx does **not** collect or use user data (no data leaves the device).
- ✅ I do not sell or transfer user data to third parties (outside approved use cases).
- ✅ I do not use or transfer user data for purposes unrelated to the item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending.

**Privacy policy URL** (required because Linkx uses `bookmarks`/`tabs`): host `PRIVACY.md` and paste its URL. Easiest options:
- **GitHub raw:** `https://raw.githubusercontent.com/masina1/Linkx/master/PRIVACY.md`
- Or enable **GitHub Pages** on the repo and link the rendered page.

---

## 6. Distribution **[you]**

- **Visibility:** Public (listed) or Unlisted (link-only). Unlisted is handy for a first release/testing.
- **Regions:** all, or a subset.

---

## 7. Submit for review **[you]**

Click **Submit for review**. Review typically takes anywhere from a few hours to a few days. You'll get an email on approval or if changes are requested. Extensions with a clear single purpose and no host permissions (like Linkx) usually clear quickly.

---

## Updating later

1. Make your change (version is bumped automatically per our workflow).
2. Re-run the packaging command in step 2.
3. In the dashboard, open the item → **Package** → upload the new ZIP → **Submit for review**.

## Pre-submit checklist

- [ ] `cd linkx && node --test` passes
- [ ] Version in `manifest.json` is higher than the last published version
- [ ] ZIP has `manifest.json` at its root (no extra wrapping folder)
- [ ] At least one 1280×800 screenshot prepared
- [ ] `PRIVACY.md` is hosted and the URL works
- [ ] Permission justifications filled in
