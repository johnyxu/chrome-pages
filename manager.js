import { getConnectedFile, connectFile, readLinksFile, writeLinksFile } from './src/storage.js';
import { removeLink } from './src/linkMerge.js';

const connectSection = document.getElementById('connect-section');
const listSection = document.getElementById('list-section');
const linkList = document.getElementById('link-list');
const connectBtn = document.getElementById('connect-btn');
const reconnectBtn = document.getElementById('reconnect-btn');
const errorEl = document.getElementById('error');

let currentHandle = null;
let currentLinks = [];

function showConnect() {
  connectSection.hidden = false;
  listSection.hidden = true;
}

function showList() {
  connectSection.hidden = true;
  listSection.hidden = false;
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
  for (const link of currentLinks) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = link.url;
    a.textContent = link.title;
    a.target = '_blank';

    const urlSpan = document.createElement('span');
    urlSpan.className = 'url';
    urlSpan.textContent = link.url;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => onRemove(link.id));

    li.append(a, urlSpan, removeBtn);
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
    showError('Could not read the connected file. Please reconnect.');
    showConnect();
  }
}

async function onRemove(id) {
  currentLinks = removeLink(currentLinks, id);
  await writeLinksFile(currentHandle, currentLinks);
  render();
}

async function onConnectClick() {
  try {
    currentHandle = await connectFile();
    await loadAndRender();
  } catch (err) {
    if (err.name !== 'AbortError') {
      showError('Could not connect the file. Please try again.');
    }
  }
}

connectBtn.addEventListener('click', onConnectClick);
reconnectBtn.addEventListener('click', onConnectClick);

async function init() {
  currentHandle = await getConnectedFile();
  if (!currentHandle) {
    showConnect();
    return;
  }
  await loadAndRender();
}

init();
