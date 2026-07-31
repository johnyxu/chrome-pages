import { getConnectedFile, getConnectedFileForAction, readLinksFile, writeLinksFile } from './src/storage.js';
import { mergeLinks } from './src/linkMerge.js';
import { tabsToEntries } from './src/tabsToEntries.js';

const saveAllBtn = document.getElementById('save-all-btn');
const saveCurrentBtn = document.getElementById('save-current-btn');
const statusEl = document.getElementById('status');
const manageLink = document.getElementById('manage-link');

const NO_FILE_MESSAGE = 'No file connected. Open "View saved links" to connect one.';
const PERMISSION_DENIED_MESSAGE =
  'Permission was not granted. Reconnect from "View saved links" if this keeps happening.';
const CORRUPTED_MESSAGE = 'The connected file isn\'t a valid Tab Saver file — nothing was written. Reconnect from "View saved links".';

let busy = false;

async function saveTabs(tabs) {
  if (busy) return;
  busy = true;
  statusEl.textContent = 'Saving…';
  try {
    let handle;
    try {
      // Runs inside a click handler, so it's allowed to silently re-request
      // permission if it was lost (Chrome resets File System Access grants on
      // every extension reload) — this self-heals without forcing the user
      // to reconnect the file from scratch.
      handle = await getConnectedFileForAction();
    } catch (err) {
      console.warn('[tab-saver]', err);
      statusEl.textContent = err.code === 'PERMISSION_DENIED' ? PERMISSION_DENIED_MESSAGE : NO_FILE_MESSAGE;
      return;
    }
    if (!handle) {
      statusEl.textContent = NO_FILE_MESSAGE;
      return;
    }
    try {
      const { links: existingLinks, corrupted } = await readLinksFile(handle);
      if (corrupted) {
        statusEl.textContent = CORRUPTED_MESSAGE;
        return;
      }
      const entries = tabsToEntries(tabs);
      const { links, addedCount, skippedCount } = mergeLinks(existingLinks, entries);
      if (addedCount === 0) {
        statusEl.textContent = 'Already saved.';
        return;
      }
      await writeLinksFile(handle, links);
      statusEl.textContent = `Saved ${addedCount} tab(s), skipped ${skippedCount} already-saved.`;
    } catch (err) {
      console.warn('[tab-saver]', err);
      statusEl.textContent = 'Could not save — the connected file may be missing. Reconnect it from "View saved links".';
    }
  } finally {
    busy = false;
  }
}

saveAllBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  await saveTabs(tabs);
});

saveCurrentBtn.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  await saveTabs(tabs);
});

manageLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
});

async function init() {
  try {
    // Passive check only (no requestPermission prompt) since there's no user
    // gesture at popup load. A PERMISSION_DENIED here doesn't mean "no file
    // connected" — a file was connected before, it just needs its permission
    // re-requested, which saveTabs() does automatically once the user clicks
    // Save (a real click provides the gesture requestPermission needs). So
    // leave the buttons enabled in that case rather than disabling them.
    const handle = await getConnectedFile();
    if (!handle) {
      saveAllBtn.disabled = true;
      saveCurrentBtn.disabled = true;
      statusEl.textContent = NO_FILE_MESSAGE;
    }
  } catch (err) {
    console.warn('[tab-saver]', err);
    if (err.code !== 'PERMISSION_DENIED') {
      saveAllBtn.disabled = true;
      saveCurrentBtn.disabled = true;
      statusEl.textContent = NO_FILE_MESSAGE;
    }
  }
}

init();
