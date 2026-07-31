import { getConnectedFile, connectFile, readLinksFile, writeLinksFile } from './src/storage.js';
import { removeLink } from './src/linkMerge.js';
import { filterLinks } from './src/filterLinks.js';

const connectSection = document.getElementById('connect-section');
const listSection = document.getElementById('list-section');
const linkList = document.getElementById('link-list');
const connectBtn = document.getElementById('connect-btn');
const reconnectBtn = document.getElementById('reconnect-btn');
const errorEl = document.getElementById('error');
const linkCountEl = document.getElementById('link-count');
const searchInput = document.getElementById('search-input');

let currentHandle = null;
let currentLinks = [];
let searchQuery = '';
let busy = false;

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

function render() {
  linkList.innerHTML = '';
  const visibleLinks = filterLinks(currentLinks, searchQuery);

  if (currentLinks.length === 0) {
    linkCountEl.textContent = '';
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-row';
    emptyLi.textContent = 'No links saved yet — use the popup to save your first tab.';
    linkList.append(emptyLi);
    return;
  }

  linkCountEl.textContent =
    searchQuery.trim() === ''
      ? `${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`
      : `${visibleLinks.length} of ${currentLinks.length} saved link${currentLinks.length === 1 ? '' : 's'}`;

  if (visibleLinks.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-row';
    emptyLi.textContent = 'No saved links match your search.';
    linkList.append(emptyLi);
    return;
  }

  for (const link of visibleLinks) {
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
    linkList.append(li);
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
    console.warn('[tab-saver]', err);
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
      console.warn('[tab-saver]', err);
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
    searchQuery = '';
    searchInput.value = '';
    await loadAndRender();
  } catch (err) {
    console.warn('[tab-saver]', err);
    if (err.name !== 'AbortError') {
      showError('Could not connect the file. Please try again.');
    }
  }
}

connectBtn.addEventListener('click', onConnectClick);
reconnectBtn.addEventListener('click', onConnectClick);
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  render();
});

async function init() {
  try {
    currentHandle = await getConnectedFile();
  } catch (err) {
    console.warn('[tab-saver]', err);
    if (err.code === 'PERMISSION_DENIED') {
      showError('Permission to your saved-links file was lost. Please reconnect.');
    } else {
      showError('Could not access the previously connected file. Please reconnect.');
    }
    showConnect();
    return;
  }
  if (!currentHandle) {
    showConnect();
    return;
  }
  await loadAndRender();
}

init();
