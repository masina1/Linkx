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
