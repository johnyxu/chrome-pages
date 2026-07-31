import {
  getConnectedFileForAction,
  readLinksFile,
  writeLinksFile,
  getCloseTabAfterSave,
  setCloseTabAfterSave,
} from './src/storage.js';
import { mergeLinks } from './src/linkMerge.js';
import { tabsToEntries } from './src/tabsToEntries.js';
import { logExpected, logUnexpected } from './src/log.js';

const saveAllBtn = document.getElementById('save-all-btn');
const saveCurrentBtn = document.getElementById('save-current-btn');
const statusEl = document.getElementById('status');
const manageLink = document.getElementById('manage-link');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeTabToggle = document.getElementById('close-tab-toggle');

const NO_FILE_MESSAGE = 'No file connected. Open "View saved links" to connect one.';
const PERMISSION_DENIED_MESSAGE =
  'Permission was not granted. Reconnect from "View saved links" if this keeps happening.';
const CORRUPTED_MESSAGE = 'The connected file isn\'t a valid Tab Saver file — nothing was written. Reconnect from "View saved links".';

let busy = false;

async function closeSavedTabs(tabs, entries) {
  if (!(await getCloseTabAfterSave())) return;
  const savedUrls = new Set(entries.map((entry) => entry.url));
  const tabIds = tabs.filter((tab) => savedUrls.has(tab.url)).map((tab) => tab.id);
  if (tabIds.length === 0) return;
  try {
    await chrome.tabs.remove(tabIds);
  } catch (err) {
    logUnexpected('closing saved tabs', err);
  }
}

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
      if (err.code === 'PERMISSION_DENIED') {
        // Expected when the user declines (or dismisses) the permission
        // prompt that getConnectedFileForAction() just showed — not a bug.
        logExpected('save: permission not granted', err);
        statusEl.textContent = PERMISSION_DENIED_MESSAGE;
      } else {
        logUnexpected('save: checking connected file', err);
        statusEl.textContent = NO_FILE_MESSAGE;
      }
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
        await closeSavedTabs(tabs, entries);
        return;
      }
      await writeLinksFile(handle, links);
      statusEl.textContent = `Saved ${addedCount} tab(s), skipped ${skippedCount} already-saved.`;
      await closeSavedTabs(tabs, entries);
    } catch (err) {
      logUnexpected('save: reading/writing file', err);
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

settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

closeTabToggle.addEventListener('change', () => {
  setCloseTabAfterSave(closeTabToggle.checked).catch((err) => {
    logUnexpected('saving settings', err);
  });
});

async function init() {
  try {
    closeTabToggle.checked = await getCloseTabAfterSave();
  } catch (err) {
    logUnexpected('loading settings', err);
  }

  try {
    // Opening the popup (clicking the toolbar icon) is itself a user action,
    // so try requesting permission right away — getConnectedFileForAction()
    // is allowed to prompt. If Chrome doesn't carry enough activation into
    // the popup for that to work, verifyPermission() catches the resulting
    // SecurityError internally and this just throws PERMISSION_DENIED like
    // normal, same as the passive check would have — no worse off either way.
    const handle = await getConnectedFileForAction();
    if (!handle) {
      saveAllBtn.disabled = true;
      saveCurrentBtn.disabled = true;
      statusEl.textContent = NO_FILE_MESSAGE;
    }
  } catch (err) {
    if (err.code === 'PERMISSION_DENIED') {
      // Expected if the prompt above didn't grant access (declined, or no
      // activation to show it) — not a bug. saveTabs() retries this on every
      // Save click, which always has a real click gesture behind it.
      logExpected('permission check at load', err);
    } else {
      logUnexpected('permission check at load', err);
      saveAllBtn.disabled = true;
      saveCurrentBtn.disabled = true;
      statusEl.textContent = NO_FILE_MESSAGE;
    }
  }
}

init();
