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
