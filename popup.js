import { getConnectedFile, readLinksFile, writeLinksFile } from './src/storage.js';
import { mergeLinks } from './src/linkMerge.js';
import { tabsToEntries } from './src/tabsToEntries.js';

const saveAllBtn = document.getElementById('save-all-btn');
const saveCurrentBtn = document.getElementById('save-current-btn');
const statusEl = document.getElementById('status');
const manageLink = document.getElementById('manage-link');

const NO_FILE_MESSAGE = 'No file connected. Open "View saved links" to connect one.';
const CORRUPTED_MESSAGE = 'The connected file isn\'t a valid Tab Saver file — nothing was written. Reconnect from "View saved links".';

let busy = false;

async function saveTabs(tabs) {
  if (busy) return;
  busy = true;
  statusEl.textContent = 'Saving…';
  try {
    let handle;
    try {
      handle = await getConnectedFile();
    } catch (err) {
      // Treat a lost/denied permission the same as "no file connected" here —
      // manager.js shows a distinct message for this case, but that level of
      // detail isn't needed in the popup.
      console.warn('[tab-saver]', err);
      handle = null;
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
  let handle;
  try {
    handle = await getConnectedFile();
  } catch (err) {
    // Same simplification as saveTabs(): a thrown PERMISSION_DENIED is
    // treated identically to "never connected" for the popup's purposes.
    console.warn('[tab-saver]', err);
    handle = null;
  }
  if (!handle) {
    saveAllBtn.disabled = true;
    saveCurrentBtn.disabled = true;
    statusEl.textContent = NO_FILE_MESSAGE;
  }
}

init();
