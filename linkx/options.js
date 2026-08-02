import { getConfig, setConfig, CONFIG_KEY } from './lib/storage.js';
import {
  DAYS, normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays,
  getActiveProfile, PALETTE, MAX_PROFILES,
  addProfile, renameProfile, setProfileColor, deleteProfile, setActiveProfile,
} from './lib/logic.js';

let config = { settings: {}, links: [] };
let editingProfileId = null;

// The profile currently open for editing (falls back to the active one).
function cp() {
  return config.profiles.find((p) => p.id === editingProfileId) || getActiveProfile(config);
}

let dragFrom = null;

const $ = (id) => document.getElementById(id);

async function save() {
  await setConfig(config);
}

function reindex() {
  cp().links.forEach((l, i) => { l.order = i; });
}

// ---- Settings ----

function renderSettings() {
  $('openIn').value = cp().settings.openIn;
  $('autoOpen').value = cp().settings.autoOpenOnStartup ? 'yes' : 'no';
  $('showBadge').value = cp().settings.showDayBadge ? 'yes' : 'no';
}

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

  // Delete (hidden for the permanent default profile — the first one)
  if (p.id !== config.profiles[0].id) {
    const del = document.createElement('button');
    del.className = 'delete-profile-btn';
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

function wireSettings() {
  $('openIn').addEventListener('change', (e) => {
    cp().settings.openIn = e.target.value; save();
  });
  $('autoOpen').addEventListener('change', (e) => {
    cp().settings.autoOpenOnStartup = e.target.value === 'yes'; save();
  });
  $('showBadge').addEventListener('change', (e) => {
    cp().settings.showDayBadge = e.target.value === 'yes'; save();
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
  cp().links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: cp().links.length,
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
  $('links-empty').style.display = cp().links.length ? 'none' : 'block';

  cp().links.forEach((link, index) => {
    list.appendChild(renderRow(link, index));
  });

  syncBookmarkChecks();
}

function syncBookmarkChecks() {
  const urls = new Set(cp().links.map((l) => l.url));
  document.querySelectorAll('#bookmarks-tree input[type="checkbox"]').forEach((cb) => {
    cb.checked = urls.has(cb.dataset.url);
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
  title.title = 'Title';
  title.addEventListener('change', () => { link.title = title.value.trim() || link.url; save(); });
  row.appendChild(title);

  // URL (editable input, validated on change)
  const urlInput = document.createElement('input');
  urlInput.className = 'url-input';
  urlInput.type = 'text';
  urlInput.value = link.url;
  urlInput.title = link.url;
  urlInput.addEventListener('change', () => {
    const normalized = normalizeUrl(urlInput.value);
    if (normalized) {
      link.url = normalized;
      urlInput.value = normalized;
      urlInput.title = normalized;
      save();
    } else {
      urlInput.value = link.url; // revert an invalid entry
    }
  });
  row.appendChild(urlInput);

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
    cp().links = cp().links.filter((l) => l.id !== link.id);
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
  if (to < 0 || to >= cp().links.length) return;
  const [item] = cp().links.splice(from, 1);
  cp().links.splice(to, 0, item);
  reindex();
  save();
  renderLinks();
}

// ---- Bookmark helpers (used by Task 7) ----

function addLinkFromBookmark(title, url) {
  cp().links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: cp().links.length,
  });
  reindex();
  save();
  renderLinks();
}

function removeLinkByUrl(url) {
  cp().links = cp().links.filter((l) => l.url !== url);
  reindex();
  save();
  renderLinks();
}

// ---- Bookmark import ----

function renderBookmarkNode(node) {
  if (node.url) {
    const label = document.createElement('label');
    label.className = 'bm-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.url = node.url;
    cb.checked = cp().links.some((l) => l.url === node.url);
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

// ---- Init ----

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

init();

chrome.storage.onChanged.addListener((changes) => {
  const change = changes[CONFIG_KEY];
  if (!change || !change.newValue) return;
  const newActive = change.newValue.activeProfileId;
  // Only react to an EXTERNAL active-profile switch; ignore our own saves
  // (which set config.activeProfileId before writing) and link/setting edits
  // (which never change activeProfileId).
  if (newActive && newActive !== config.activeProfileId) {
    config.activeProfileId = newActive;
    renderProfiles();
  }
});

export { config, save, reindex, renderLinks, addLinkFromBookmark, removeLinkByUrl };
