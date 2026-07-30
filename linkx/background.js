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
chrome.action.onClicked.addListener(() => { openToday().catch(console.error); });

// Keep the badge in sync.
chrome.runtime.onInstalled.addListener(() => {
  refreshBadge();
  chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(async () => {
  await refreshBadge();
  const existing = await chrome.alarms.get(DAILY_ALARM);
  if (!existing) chrome.alarms.create(DAILY_ALARM, { periodInMinutes: 60 });
  const { settings } = await getConfig();
  if (settings.autoOpenOnStartup) await openToday();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) refreshBadge();
});

// When settings change from the options page, update the badge immediately.
chrome.storage.onChanged.addListener(() => { refreshBadge(); });
