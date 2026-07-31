import { parseLinksFile, serializeLinksFile } from './linksFile.js';

const DB_NAME = 'tab-saver';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'linksFile';

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

async function getStoredHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function setStoredHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// requestPermission() requires transient user activation (a real click) —
// calling it with no active gesture throws a SecurityError instead of
// resolving to 'denied'. `allowPrompt` must only be set to true by callers
// that run inside a user-gesture handler (a click), never from page-load
// code like init().
async function verifyPermission(handle, mode = 'readwrite', { allowPrompt = false } = {}) {
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  if (allowPrompt) {
    return (await handle.requestPermission({ mode })) === 'granted';
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
  await setStoredHandle(handle);
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
  const handle = await getStoredHandle();
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
  const handle = await getStoredHandle();
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

export async function readLinksFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  return parseLinksFile(text);
}

export async function writeLinksFile(handle, links) {
  const writable = await handle.createWritable();
  await writable.write(serializeLinksFile(links));
  await writable.close();
}
