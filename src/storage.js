import { parseLinksFile, serializeLinksFile } from './linksFile.js';
import { logExpected, logUnexpected } from './log.js';

const DB_NAME = 'tab-saver';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'linksFile';
const BACKUP_HANDLE_KEY = 'backupFile';
const CLOSE_TAB_AFTER_SAVE_KEY = 'closeTabAfterSave';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredValue(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    // `req.result` is `undefined` for a missing key — but a stored `false`
    // (a legitimate settings value) must round-trip as `false`, not get
    // coalesced into `null` the way `req.result || null` would.
    req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setStoredValue(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function suggestBackupName(mainName) {
  return `${mainName.replace(/\.json$/i, '')}.bak.json`;
}

// requestPermission() requires transient user activation (a real click) —
// calling it with no active gesture throws a SecurityError instead of
// resolving to 'denied'. `allowPrompt` should only be set to true by callers
// that have a reasonable chance of running with an active gesture (a click
// handler, or a popup opened by clicking the toolbar icon). Any failure —
// a real 'denied' choice, or a thrown SecurityError from insufficient
// activation — is normalized to `false` here so callers always get a plain
// PERMISSION_DENIED and never have to handle a raw DOMException themselves.
async function verifyPermission(handle, mode = 'readwrite', { allowPrompt = false } = {}) {
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  if (allowPrompt) {
    try {
      return (await handle.requestPermission({ mode })) === 'granted';
    } catch (err) {
      logUnexpected('requestPermission', err);
      return false;
    }
  }
  return false;
}

function permissionDeniedError(handle) {
  const err = new Error('Permission to the connected file was denied.');
  err.code = 'PERMISSION_DENIED';
  err.handle = handle;
  return err;
}

export async function connectFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'saved-tabs.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  await setStoredValue(HANDLE_KEY, handle);

  // The backup file is optional: if the user cancels this second picker (or
  // it fails for any other reason), keep the main connection and just skip
  // the backup rather than aborting the whole connect flow.
  try {
    const backupHandle = await window.showSaveFilePicker({
      suggestedName: suggestBackupName(handle.name),
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    await setStoredValue(BACKUP_HANDLE_KEY, backupHandle);
  } catch (err) {
    // Expected: the user commonly cancels this second picker to skip having
    // a backup at all.
    logExpected('backup file not connected', err);
  }

  return handle;
}

// Passive check for page-load code (no user gesture available, e.g. init()).
// Returns null only when no file has ever been connected (no stored handle).
// If a handle is stored but permission was denied/revoked (which Chrome does
// on every extension reload — the permission grant does not persist the way
// earlier code assumed), throws an Error with `.code === 'PERMISSION_DENIED'`
// and `.handle` set to the stored handle, so callers can offer to re-request
// permission on it directly (via regrantPermission()) instead of forcing the
// user to re-pick the file from scratch.
export async function getConnectedFile() {
  const handle = await getStoredValue(HANDLE_KEY);
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'readwrite');
  if (!ok) throw permissionDeniedError(handle);
  return handle;
}

// Same as getConnectedFile(), but for use inside a user-gesture handler (a
// click). If permission was lost, this re-requests it on the existing handle
// — Chrome shows a lightweight permission prompt, not the file picker — so
// access can be restored without reconnecting the file from scratch.
export async function getConnectedFileForAction() {
  const handle = await getStoredValue(HANDLE_KEY);
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'readwrite', { allowPrompt: true });
  if (!ok) throw permissionDeniedError(handle);
  return handle;
}

// Re-requests permission on a specific handle. Must be called from inside a
// user-gesture handler (a click) — see verifyPermission's allowPrompt note.
export async function regrantPermission(handle) {
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export async function getCloseTabAfterSave() {
  return (await getStoredValue(CLOSE_TAB_AFTER_SAVE_KEY)) === true;
}

export async function setCloseTabAfterSave(value) {
  await setStoredValue(CLOSE_TAB_AFTER_SAVE_KEY, Boolean(value));
}

export async function readLinksFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return parseLinksFile(text);
}

export async function writeLinksFile(handle, links) {
  const writable = await handle.createWritable();
  await writable.write(serializeLinksFile(links));
  await writable.close();

  // Best-effort: mirror the same content into the backup file, if one is
  // connected. A backup write failure (lost permission, file moved) never
  // fails the primary write — it's a safety net, not a requirement. Since
  // it's written with the same `links` array on every save AND remove, an
  // entry only disappears from the backup when it's removed from the main
  // file too (a save only ever adds entries, never removes them).
  const backupHandle = await getStoredValue(BACKUP_HANDLE_KEY);
  if (backupHandle) {
    try {
      const backupWritable = await backupHandle.createWritable();
      await backupWritable.write(serializeLinksFile(links));
      await backupWritable.close();
    } catch (err) {
      logUnexpected('backup write failed', err);
    }
  }
}
