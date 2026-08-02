# Linkx

A tiny Manifest V3 Chrome extension that opens the bookmarks you've chosen for **today's weekday** in one click.

- **One-click open** — click the toolbar icon to open every link assigned to the current day, in your chosen order.
- **Color-coded profiles** — keep up to 5 independent profiles (e.g. Work, Gaming, Dev), each with its own links and settings. The toolbar icon and badge recolor to the active profile; **right-click the icon to switch**.
- **Add from any page** — right-click a webpage → **Linkx** to add it to the active profile (with or without days) or switch profiles.
- **Per-day scheduling** — assign each link to any combination of Mon–Sun, with Everyday / Weekdays / Weekends / Clear shortcuts.
- **Bookmark import** — pick links straight from your existing Chrome bookmarks.
- **New tab or new window** — your choice.
- **Day badge** — the toolbar icon shows the current weekday.
- **Auto-open on startup** — optionally open today's links when Chrome starts.

No build step, no third-party dependencies, no network calls. All data stays in `chrome.storage` (synced via your Google account, with a local fallback).

## Install (development / unpacked)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the [`linkx/`](linkx/) folder (the one containing `manifest.json`).
3. Click the toolbar icon to open today's links; right-click it → **Options** to configure.

## Publishing

See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for the Chrome Web Store submission guide, listing copy, and permission justifications.

## Development

```bash
cd linkx
node --test          # run the unit tests
node --check background.js   # syntax-check a module
```

## License

Copyright © 2026 masina1.

Linkx is licensed under [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt it with attribution, but **not for commercial purposes**. See [`LICENSE`](LICENSE) for the full text.
