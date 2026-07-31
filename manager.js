import {
  getConnectedFile,
  connectFile,
  readLinksFile,
  writeLinksFile,
  regrantPermission,
} from './src/storage.js';
import { removeLink } from './src/linkMerge.js';
import { filterLinks } from './src/filterLinks.js';
import { groupLinksByDomain } from './src/groupByDomain.js';
import { logExpected, logUnexpected } from './src/log.js';

const connectSection = document.getElementById('connect-section');
const listSection = document.getElementById('list-section');
const linkList = document.getElementById('link-list');
const connectMessageEl = document.getElementById('connect-message');
const connectBtn = document.getElementById('connect-btn');
const grantBtn = document.getElementById('grant-btn');
const reconnectBtn = document.getElementById('reconnect-btn');
const errorEl = document.getElementById('error');
const linkCountEl = document.getElementById('link-count');
const searchInput = document.getElementById('search-input');

let currentHandle = null;
let currentLinks = [];
let searchQuery = '';
let busy = false;
let pendingHandle = null;

function showPermissionLostUI(handle) {
  pendingHandle = handle;
  connectMessageEl.textContent = 'Access to your previously connected file was lost.';
  grantBtn.hidden = false;
  connectBtn.textContent = 'Or connect a different file';
  connectBtn.classList.remove('btn-primary');
  connectBtn.classList.add('btn-secondary');
}

function resetConnectUI() {
  pendingHandle = null;
  connectMessageEl.textContent = 'No file connected yet.';
  grantBtn.hidden = true;
  connectBtn.textContent = 'Connect a file';
  connectBtn.classList.add('btn-primary');
  connectBtn.classList.remove('btn-secondary');
}

function showConnect() {
  connectSection.hidden = false;
  listSection.hidden = true;
  reconnectBtn.hidden = true;
  linkCountEl.textContent = '';
}

function showList() {
  connectSection.hidden = true;
  listSection.hidden = false;
  reconnectBtn.hidden = false;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function renderEmptyMessage(text) {
  const p = document.createElement('p');
  p.className = 'empty-row';
  p.textContent = text;
  linkList.append(p);
}

function renderLinkItem(link) {
  const li = document.createElement('li');
  li.className = 'link-item';

  const main = document.createElement('div');
  main.className = 'link-main';

  const a = document.createElement('a');
  a.className = 'link-title';
  a.href = link.url;
  a.textContent = link.title;
  a.target = '_blank';

  const meta = document.createElement('div');
  meta.className = 'link-meta';

  const urlSpan = document.createElement('span');
  urlSpan.className = 'link-url';
  urlSpan.textContent = link.url;

  const dotSpan = document.createElement('span');
  dotSpan.className = 'link-dot';
  dotSpan.textContent = '·';

  const savedAtSpan = document.createElement('span');
  savedAtSpan.className = 'link-date';
  savedAtSpan.textContent = new Date(link.savedAt).toLocaleDateString();

  meta.append(urlSpan, dotSpan, savedAtSpan);
  main.append(a, meta);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => onRemove(link.id));

  li.append(main, removeBtn);
  return li;
}

function render() {
  linkList.innerHTML = '';
  const visibleLinks = filterLinks(currentLinks, searchQuery);

  if (currentLinks.length === 0) {
    linkCountEl.textContent = '';
    renderEmptyMessage('No links saved yet — use the popup to save your first tab.');
    return;
  }

  linkCountEl.textContent =
    searchQuery.trim() === ''
      ? `${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`
      : `${visibleLinks.length} of ${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`;

  if (visibleLinks.length === 0) {
    renderEmptyMessage('No saved links match your search.');
    return;
  }

  for (const group of groupLinksByDomain(visibleLinks)) {
    const section = document.createElement('section');
    section.className = 'link-group';

    const header = document.createElement('h2');
    header.className = 'group-header';
    header.textContent = group.domain;
    const countSpan = document.createElement('span');
    countSpan.className = 'group-count';
    countSpan.textContent = ` (${group.links.length})`;
    header.append(countSpan);

    const ul = document.createElement('ul');
    ul.className = 'link-list';
    for (const link of group.links) {
      ul.append(renderLinkItem(link));
    }

    section.append(header, ul);
    linkList.append(section);
  }
}

async function loadAndRender() {
  try {
    const { links, corrupted } = await readLinksFile(currentHandle);
    currentLinks = links;
    if (corrupted) {
      showError('Saved file was unreadable — starting from an empty list.');
    } else {
      clearError();
    }
    render();
    showList();
  } catch (err) {
    logUnexpected('reading connected file', err);
    showError('Could not read the connected file. Please reconnect.');
    showConnect();
  }
}

async function onRemove(id) {
  if (busy) return;
  busy = true;
  try {
    currentLinks = removeLink(currentLinks, id);
    try {
      await writeLinksFile(currentHandle, currentLinks);
      render();
    } catch (err) {
      // The write failed (e.g. the file was moved/deleted or permission was
      // revoked after load), so `currentLinks` is now out of sync with disk.
      // Re-read from the handle rather than rendering the stale mutated array;
      // if that also fails, loadAndRender()'s own catch already surfaces the
      // inline error + reconnect path.
      logUnexpected('removing link', err);
      showError('Could not remove — the file may be unavailable. Please reconnect.');
      await loadAndRender();
    }
  } finally {
    busy = false;
  }
}

async function onConnectClick() {
  try {
    currentHandle = await connectFile();
    resetConnectUI();
    clearError();
    searchQuery = '';
    searchInput.value = '';
    await loadAndRender();
  } catch (err) {
    if (err.name !== 'AbortError') {
      logUnexpected('connecting file', err);
      showError('Could not connect the file. Please try again.');
    }
  }
}

async function onGrantClick() {
  if (!pendingHandle) return;
  try {
    const granted = await regrantPermission(pendingHandle);
    if (!granted) {
      logExpected('grant access', 'user did not grant permission');
      showError('Permission was not granted. Connect a different file instead.');
      return;
    }
    currentHandle = pendingHandle;
    resetConnectUI();
    clearError();
    await loadAndRender();
  } catch (err) {
    logUnexpected('granting access', err);
    showError('Could not verify permission. Please try again or connect a different file.');
  }
}

connectBtn.addEventListener('click', onConnectClick);
reconnectBtn.addEventListener('click', onConnectClick);
grantBtn.addEventListener('click', onGrantClick);
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  render();
});

async function init() {
  try {
    currentHandle = await getConnectedFile();
  } catch (err) {
    if (err.code === 'PERMISSION_DENIED' && err.handle) {
      // Expected on every page load until the user clicks "Grant access" —
      // Chrome resets File System Access permission grants on every
      // extension reload, so this isn't a bug, just the normal pre-repair
      // state. Logged at debug level so it doesn't pile up as an extension
      // "error" in chrome://extensions.
      logExpected('permission check at load', err);
      showError('Permission to your saved-links file was lost.');
      showPermissionLostUI(err.handle);
    } else {
      logUnexpected('permission check at load', err);
      showError('Could not access the previously connected file. Please reconnect.');
      resetConnectUI();
    }
    showConnect();
    return;
  }
  if (!currentHandle) {
    resetConnectUI();
    showConnect();
    return;
  }
  await loadAndRender();
}

init();
