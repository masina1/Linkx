# Linkx — Privacy Policy

_Last updated: 2026-07-30_

Linkx is a browser extension that opens the bookmarks you've chosen for the current weekday. This policy explains what data the extension handles and how.

## Summary

**Linkx does not collect, transmit, sell, or share any personal data.** Everything the extension uses stays inside your own browser.

## What data Linkx handles

- **Your link list and settings** — the links you add (title, URL, and the days you assign them to) and your preferences (open in new tab/window, auto-open on startup, show day badge). This is saved with the Chrome storage API (`chrome.storage.sync`, falling back to `chrome.storage.local`).
- **Your Chrome bookmarks** — read **only** so the options page can display them for you to import. Linkx never modifies, deletes, or transmits your bookmarks. Only the links you explicitly choose are copied into your Linkx link list.

## Where the data goes

- Data is stored **locally in your browser**. If you're signed in to Chrome, `chrome.storage.sync` may synchronize it across your own signed-in devices through your Google account — this is handled by Chrome, not by Linkx.
- Linkx has **no backend server**, makes **no network requests**, and includes **no analytics, tracking, advertising, or remote code**.
- No data is ever sent to the developer or to any third party.

## Permissions and why they're used

- **bookmarks** — to show your existing bookmarks on the options page so you can import them.
- **storage** — to save your link list and settings.
- **tabs** — to open your selected links in new tabs/windows when you click the icon or on startup.
- **alarms** — to refresh the toolbar day badge periodically so it shows the correct weekday.

## Data retention and deletion

Your data remains until you remove links in the options page or uninstall the extension. Uninstalling Linkx removes its locally stored data. Synced data is managed through your Chrome/Google account.

## Contact

Questions about this policy? Open an issue at <https://github.com/masina1/Linkx>.
