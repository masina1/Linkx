import { getConfig, setConfig } from './lib/storage.js';
import {
  DAYS, normalizeUrl, emptyDays, everydayDays, weekdayDays, weekendDays,
} from './lib/logic.js';

let config = { settings: {}, links: [] };
let dragFrom = null;

const $ = (id) => document.getElementById(id);

async function save() {
  await setConfig(config);
}

function reindex() {
  config.links.forEach((l, i) => { l.order = i; });
}

// ---- Settings ----

function renderSettings() {
  $('openIn').value = config.settings.openIn;
  $('autoOpen').value = config.settings.autoOpenOnStartup ? 'yes' : 'no';
  $('showBadge').value = config.settings.showDayBadge ? 'yes' : 'no';
}

function wireSettings() {
  $('openIn').addEventListener('change', (e) => {
    config.settings.openIn = e.target.value; save();
  });
  $('autoOpen').addEventListener('change', (e) => {
    config.settings.autoOpenOnStartup = e.target.value === 'yes'; save();
  });
  $('showBadge').addEventListener('change', (e) => {
    config.settings.showDayBadge = e.target.value === 'yes'; save();
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
  config.links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: config.links.length,
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
  $('links-empty').style.display = config.links.length ? 'none' : 'block';

  config.links.forEach((link, index) => {
    list.appendChild(renderRow(link, index));
  });

  syncBookmarkChecks();
}

function syncBookmarkChecks() {
  const urls = new Set(config.links.map((l) => l.url));
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
  title.addEventListener('change', () => { link.title = title.value.trim() || link.url; save(); });
  row.appendChild(title);

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
    config.links = config.links.filter((l) => l.id !== link.id);
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
  if (to < 0 || to >= config.links.length) return;
  const [item] = config.links.splice(from, 1);
  config.links.splice(to, 0, item);
  reindex();
  save();
  renderLinks();
}

// ---- Bookmark helpers (used by Task 7) ----

function addLinkFromBookmark(title, url) {
  config.links.push({
    id: crypto.randomUUID(),
    title: title || url,
    url,
    days: emptyDays(),
    order: config.links.length,
  });
  reindex();
  save();
  renderLinks();
}

function removeLinkByUrl(url) {
  config.links = config.links.filter((l) => l.url !== url);
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
    cb.checked = config.links.some((l) => l.url === node.url);
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
  config.links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  reindex();
  renderSettings();
  wireSettings();
  wireAdd();
  renderLinks();
  renderBookmarks();
}

init();

export { config, save, reindex, renderLinks, addLinkFromBookmark, removeLinkByUrl };
