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

async function verifyPermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export async function connectFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'saved-tabs.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  await setStoredHandle(handle);
  return handle;
}

// Returns null only when no file has ever been connected (no stored handle).
// If a handle is stored but permission was denied/revoked, throws an Error
// with `.code === 'PERMISSION_DENIED'` instead of returning null, so callers
// can tell "never connected" apart from "lost access to a previously
// connected file". Callers that don't care about the distinction can treat
// any thrown error the same as a null result (e.g. show the "no file
// connected" state) by catching and checking `err.code` only if they want
// the more specific message.
export async function getConnectedFile() {
  const handle = await getStoredHandle();
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'readwrite');
  if (!ok) {
    const err = new Error('Permission to the connected file was denied.');
    err.code = 'PERMISSION_DENIED';
    throw err;
  }
  return handle;
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
